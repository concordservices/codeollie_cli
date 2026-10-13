**CodeOllie CLI🤖**
_*note, for macos and windows releases, go to the tags page._
                          
A cross-platform AI-powered coding assistant running inside your terminal for local file management and dynamic AI model shifting.

**Developed by Sai Veligaram (concordservices) and sparx_the_dev**
========================================================================

------------------------------------------------------------------------
1. INSTALLATION & SHORTCUT SETUP
------------------------------------------------------------------------

- **macOS:** Download the `.pkg` installer from releases, handle security bypass if necessary on newer versions, and set up the terminal alias via `~/.zshrc`.
- **Linux & ChromeOS:** Download the standalone binary/tarball or pull via `wget`.
- **Windows:** Download and run `CodeOllie-Setup-64bit.exe` or build from source using Inno Setup 6.

------------------------------------------------------------------------
2. CORE FEATURES & COMMANDS
------------------------------------------------------------------------

Navigate to your project folder and run `codeollie` to interact with the assistant using natural language (supports single-completion tasks). Use interactive slash commands like `/model` to swap AI providers or `exit` / `Ctrl+D` to quit.

------------------------------------------------------------------------
3. SIGN-IN & AI PROVIDERS
------------------------------------------------------------------------
Supports GitHub Device Flow authentication (or use `--no-auth` to skip). Works with OpenRouter, OpenAI, NVIDIA NIM, Google Gemini, and Hugging Face.

------------------------------------------------------------------------
4. TROUBLESHOOTING & LICENSE
------------------------------------------------------------------------
Config settings are stored in `~/.codeollie/config.json`. Wipe data and re-run onboarding using `rm ~/.codeollie/config.json && codeollie`. Licensed under MIT.
