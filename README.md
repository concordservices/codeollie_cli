# CodeOllie CLI 🤖

*Note: For macOS and Windows releases, go to the tags page.*

Ever wanted an AI that can use all kinds of AI providers and is just convenient? Meet CodeOllie: a cross-platform, AI-powered coding assistant made for your terminal, developed by Sai Veligaram (concordservices) and Aadvik Suraparaju (sparx_the_dev).

---

## 1. Installation & Shortcut Setup

### 🍏 Apple macOS
Download `CodeOllieCLI_Setup-1.0.0.pkg` from releases, run the installer, and configure your terminal shortcut using:
```bash
echo "alias codeollie='open https://github.com && /Applications/CodeOllie.app/Contents/MacOS/CodeOllie --no-auth'" >> ~/.zshrc && source ~/.zshrc
```

### 🐧 Linux & ChromeOS
Download the 64-bit tarball (`CodeOllie-linux-x64.tar.gz`) or pull via `wget` from the releases page to run the setup script.

### 🪟 Microsoft Windows OS
Run `CodeOllie-Setup-64bit.exe`. To set up the `codeollie` shortcut automatically in `cmd.exe`, run  the command prompt app (not powershell because it will not work) and execute:
```powershell
reg add "HKCU\Software\Microsoft\Command Processor" /v AutoRun /t REG_SZ /d "doskey codeollie=\"C:\Program Files\CodeOllie\codeollie.exe\" " /f
```

---

## 2. CodeOllie Official Report Card 🏆
CodeOllie successfully passed evaluations across HTML/CSS, JavaScript (Countdown & Debugging), Python, and Markdown tasks with high marks.

---

## 3. Core Features & Commands
* Navigate to your project folder and type `codeollie` to launch.
* `/model` - Swap AI providers or modify model sizes.
* `exit` or `Ctrl+D` - Shut down the session safely.

---

## 4. Sign-In & Supported AI Providers
Supports GitHub Device Flow (or `--no-auth`), OpenRouter, OpenAI, NVIDIA NIM, Google Gemini, and Hugging Face.

---

## 5. Troubleshooting Configurations
Reset your configuration stored at `~/.codeollie/config.json` via:
```bash
rm ~/.codeollie/config.json && codeollie
```
and we have our github discussions so you can post issues and find solutions to fix your problem

**License:** MIT
