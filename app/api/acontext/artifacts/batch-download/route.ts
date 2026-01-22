import { NextRequest, NextResponse } from "next/server";
// @ts-ignore - pptxgenjs may not have type definitions
import PptxGenJS from "pptxgenjs";

/**
 * POST /api/acontext/artifacts/batch-download
 * Generate a PPT file from images in selection order
 * 
 * Request body:
 * {
 *   urls: Array<{ url: string; filename: string }>
 * }
 * 
 * Response:
 * PPT file (application/vnd.openxmlformats-officedocument.presentationml.presentation)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls } = body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "urls must be a non-empty array",
        },
        { status: 400 }
      );
    }

    // Validate each URL entry
    for (const item of urls) {
      if (!item.url || typeof item.url !== "string") {
        return NextResponse.json(
          {
            success: false,
            error: "Each item must have a valid 'url' string",
          },
          { status: 400 }
        );
      }
      if (!item.filename || typeof item.filename !== "string") {
        return NextResponse.json(
          {
            success: false,
            error: "Each item must have a valid 'filename' string",
          },
          { status: 400 }
        );
      }
    }

    console.log("[API] POST /api/acontext/artifacts/batch-download: Processing PPT generation", {
      count: urls.length,
    });

    // Create a new PowerPoint presentation
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE"; // 16:9 aspect ratio
    pptx.author = "Acontext Agent";
    pptx.company = "Acontext";
    pptx.title = "Images Presentation";

    const errors: Array<{ url: string; filename: string; error: string }> = [];

    // Process each URL in order (maintains selection order)
    for (const item of urls) {
      try {
        const { url, filename } = item;

        console.log("[API] batch-download: Fetching image", {
          url: url.substring(0, 100) + "...",
          filename,
        });

        // Fetch the image from the public URL
        const response = await fetch(url, {
          headers: {
            'Accept': 'image/*',
            'Accept-Encoding': 'identity',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Get content type from response headers
        const contentType = response.headers.get("content-type") || "image/png";
        
        // Check if it's actually an image
        if (!contentType.startsWith("image/")) {
          throw new Error(`Not an image: ${contentType}`);
        }

        // Convert to buffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Convert buffer to base64 data URL for pptxgenjs
        const base64 = buffer.toString("base64");
        const dataUrl = `data:${contentType};base64,${base64}`;

        // Add a slide with the image
        const slide = pptx.addSlide();
        
        // Add image to slide, filling the entire slide
        slide.addImage({
          data: dataUrl,
          x: 0,
          y: 0,
          w: "100%",
          h: "100%",
          sizing: {
            type: "contain", // Maintain aspect ratio, fit within bounds
            w: "100%",
            h: "100%",
          },
        });

        console.log("[API] batch-download: Added slide", {
          filename,
          size: buffer.length,
          mimeType: contentType,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[API] batch-download: Failed to add image", {
          url: item.url.substring(0, 100) + "...",
          filename: item.filename,
          error: errorMessage,
        });

        errors.push({
          url: item.url,
          filename: item.filename,
          error: errorMessage,
        });
      }
    }

    // Generate the PPT file
    const pptxBuffer = await pptx.write({ outputType: "nodebuffer" });

    console.log("[API] POST /api/acontext/artifacts/batch-download: PPT generated", {
      slideCount: urls.length - errors.length,
      errorCount: errors.length,
      fileSize: pptxBuffer.length,
    });

    // Return the PPT file
    return new NextResponse(pptxBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="images-${new Date().toISOString().slice(0, 10)}.pptx"`,
        ...(errors.length > 0 && {
          "X-Errors": JSON.stringify(errors),
        }),
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error("[API] Failed to generate PPT:", error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

