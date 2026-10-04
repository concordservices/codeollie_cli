========================================================================
                          CODEOLLIE CLI 🤖
========================================================================
A highly intelligent, cross-platform AI-powered coding assistant that 
runs right inside your terminal. It creates, views, and edits files 
directly within your local projects while supporting secure GitHub 
authentication and dynamic model shifting across multiple AI providers.

VERSION: 0.1.1
DEVELOPED BY: concordservices
MACOS DISCOVERY & PIPELINES BY: sparx_the_dev
========================================================================

------------------------------------------------------------------------
1. INSTALLATION & SHORTCUT SETUP
------------------------------------------------------------------------

🍏 APPLE macOS (macOS 15 through macOS 27+)
===========================================
  1. Open your web browser and go to the official project releases page.
  2. Download the installer file: CodeOllie-1.0.0.pkg
  3. Double-click the file to open the official installation wizard.
  
  * SECURITY BYPASS NOTE FOR macOS 27+: 
    If a warning pops up saying the package cannot be opened because it 
    is from an unidentified developer, click Cancel. Open your Mac's 
    System Settings -> Privacy & Security. Scroll down to the Security 
    section and click the "Open Anyway" button, then enter your password.

  4. Once the wizard finishes, open a brand-new Terminal window.
  5. Copy, paste, and run this command once to set up your shortcut link:
  
     echo "alias codeollie='open https://github.com && /Applications/CodeOllie.app/Contents/MacOS/CodeOllie --no-auth'" >> ~/.zshrc && source ~/.zshrc

  6. Simply type "codeollie" anywhere in your terminal to launch!


🐧 LINUX SYSTEMS (Ubuntu, Debian, DietPi, etc.)
==============================================
  [ IN DEVELOPMENT ]
  The native Linux standalone application binary and automated setup 
  packages are currently being built. We expect the universal Linux 
  edition to release very soon! Stay tuned to the repository updates.


🪟 MICROSOFT WINDOWS OS (64-bit systems)
========================================
  Download and execute the "CodeOllie.msi" installer package from the 
  latest stable release assets on the GitHub page. Follow the setup 
  prompts to register the global system path automatically.


------------------------------------------------------------------------
2. CORE FEATURES & COMMANDS
------------------------------------------------------------------------

BASIC USAGE:
============
To use the AI agent on a project repository, open your terminal, navigate
into the targeted codebase folder, and fire it up:

    cd /path/to/your/project-folder
    codeollie

Once running, you can speak directly to the assistant in natural language.
For example:
  - "Create a new React component for user authentication."
  - "Review index.js and help me fix any logic performance issues."
  - "Generate an absolute path configuration file."

INTERACTIVE SLASH COMMANDS:
===========================
Inside the CodeOllie terminal chat window, use these commands to control
the underlying environment:

  /model  - Opens a setup menu to swap AI providers or modify model sizes.
  exit    - Shuts down the agent session safely and returns to local shell.


------------------------------------------------------------------------
3. SUPPORTED AI PROVIDERS
------------------------------------------------------------------------
CodeOllie works seamlessly with five major external environments:

  * OpenRouter  - Gateway proxy for Nemotron 3 Ultra, GPT-4, and Claude.
  * OpenAI      - Direct interaction with native GPT models.
  * NVIDIA NIM  - Fast inference configurations for Nemotron targets.
  * Google      - Integration for Gemini Pro and Vision models.
  * Hugging Face- Native support for custom endpoint spaces (SGM-1 MoE).


------------------------------------------------------------------------
4. TROUBLESHOOTING CONFIGURATIONS
------------------------------------------------------------------------
Your system configuration settings are securely stored locally inside a 
hidden user directory located at: ~/.codeollie/config.json

If your API key breaks, if you change accounts, or if you encounter an 
unresponsive setup prompt, completely wipe the old data footprint and 
re-run onboarding using this terminal line:

    rm ~/.codeollie/config.json && codeollie

------------------------------------------------------------------------
LICENSE: MIT
========================================================================

