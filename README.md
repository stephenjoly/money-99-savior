# Money 99 Savior – Correct common defects in QFX/QBO/OFX files for use with Microsoft Money 1999

A free and open-source application for viewing financial transactions and cleaning OFX files specifically designed for compatibility with Microsoft Money 99 and other legacy financial software.

Check it out at https://money-99-savior.stephenjoly.net

## Overview

Money 99 Savior processes OFX (Open Financial Exchange) files to ensure compatibility with Microsoft Money 99 and similar financial software that have strict formatting requirements. It has been thoroughly tested and confirmed working with Microsoft Money 99.

## Features

- **OFX File Processing**: Cleans and standardizes OFX files for maximum compatibility with Money 99
- **Runs Entirely in Your Browser**: Your statement is never uploaded. The server only serves the page; there is no file upload endpoint
- **Transaction Viewing**: View your financial transactions in a clean, organized interface
- **Correction Summary**: A receipt after every upload showing exactly what was changed and why
- **Per-Transaction Edits**: See which transactions were renamed or shortened, with before/after names, and filter to just the changed ones
- **Correction Rules Page**: Browse and edit the merchant rename rules, with live preview, import/export, and a "used" count (`/rules`). After editing, reapply rules to the open statement without picking the file again
- **Plain Text or Pattern Rules**: Match exact text with no regex knowledge needed, or switch to patterns for variants like store numbers and alternate spellings, with a built-in cheat sheet
- **Name Standardization**: Automatically standardizes merchant names for better categorization
- **Character Limit Handling**: Truncates transaction names to 32 characters to meet MS Money 99 requirements
- **Tag Cleanup**: Removes unnecessary tags that can cause issues with legacy software
- **XML/SGML Support**: Works with both XML and SGML formatted OFX files

## Technical Details

Money 99 Savior handles several common issues with OFX files that prevent them from working with Money 99:

- Converts modern OFX headers to the format expected by Money 99
- Truncates transaction names that exceed 32 characters (a common limitation in Money 99)
- Removes problematic tags like `<SIC>` and `<CORRECTFITID>`
- Standardizes common merchant names for better readability
- Lets you add, edit, and delete your own merchant rename rules; they live in your browser's local storage
- Handles both XML-style OFX (with closing tags) and SGML-style OFX (without closing tags)
- Replaces certain common patterns that occur when merchants with multiple locations add unit store numbers to credit card network names (e.g., replaces "Costco 2341238" with "Costco")

### Privacy and architecture

All OFX parsing, cleaning, and rule matching happen in the browser. There is no
upload endpoint — the server is a static file host with a `/health` check. A
statement never leaves the machine it was opened on, and rule matching runs
locally too.

## Usage

1. Open the app and choose your OFX file — it is read locally in your browser
2. Money 99 Savior cleans the file in the page; nothing is sent to a server
3. Review the receipt: a summary of corrections, plus the transaction list with changed entries highlighted
4. Optionally edit correction rules, then use **Reapply rules** to refresh the receipt without re-choosing the file
5. Download the cleaned OFX file for use with Microsoft Money 99

## Compatibility

Money 99 Savior has been tested with:
- Microsoft Money 99
- OFX files from major banks and financial institutions
- File formats: .ofx, .qfx, and .qbo

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests if you have suggestions for improvements to help keep Money 99 alive and working in the modern era.

## Support

If you encounter any issues or have questions about using Money 99 Savior, please feel free to open an issue or a discussion thread.

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgements

Thanks to all the users who have tested Money 99 Savior and provided feedback to make it more robust and compatible with various financial institutions' OFX formats.

---

**Note**: Money 99 Savior does not store your financial data. Files are opened and cleaned in your browser and are never uploaded.
