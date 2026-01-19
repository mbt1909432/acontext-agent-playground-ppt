How to add a new character (frontend)
======================================

1) Prepare assets
- Create a new folder under `public/fonts/` (e.g., `character3/`).
- Add the avatar image (for the selector) and chatbot avatar image (for in-chat UI). Keep names consistent with existing ones, e.g., `ppt girl.png` and `ppt_girl_chatbot.png`, and use transparent background PNGs.

2) Extend the type
- In `contexts/character-context.tsx`, update the `CharacterId` union to include your new id (e.g., `"character3"`).

3) Add the config entry
- In `CHARACTERS`, add a new object keyed by your id with:
  - `id`: the same string as your new CharacterId
  - `name`: display name
  - `avatarPath`: path to the selector avatar (e.g., `/fonts/character3/ppt girl.png`)
  - `chatbotAvatarPath`: path to the chat avatar (e.g., `/fonts/character3/ppt_girl_chatbot.png`)
  - `systemPrompt`: full English prompt describing personality, visual style, palette, layout rules, tool usage rules, and response flow (outline → confirm → generate)

4) Default selection (optional)
- If you want the new character to be the default, set `DEFAULT_CHARACTER` to your new id.

5) Verify usage
- Ensure any character picker or UI components read from `characters` (they map over `Object.values(CHARACTERS)`), so adding the config entry makes it appear automatically.
- Run the app and switch to the new character to confirm avatars load and prompts behave as intended.

Notes on systemPrompt
- Keep prompts in English (the image prompts must be English).
- Spell out the visual style: theme, palette, background/foreground separation, 16:9 requirement, and mandatory keywords for image generation.
- Include tool-use rules if you need outline confirmation before generation.

