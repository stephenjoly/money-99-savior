# Money 99 Savior – Correct common defects in QFX/QBO/OFX files for use with Microsoft Money 1999

A free and open-source application for viewing financial transactions and cleaning OFX files specifically designed for compatibility with Microsoft Money 99 and other legacy financial software.

## Overview

Money 99 Savior processes OFX (Open Financial Exchange) files to ensure compatibility with Microsoft Money 99 and similar financial software that have strict formatting requirements. It has been thoroughly tested and confirmed working with Microsoft Money 99.

## Features

- **OFX File Processing**: Cleans and standardizes OFX files for maximum compatibility with Money 99
- **Transaction Viewing**: View your financial transactions in a clean, organized interface
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
- Handles both XML-style OFX (with closing tags) and SGML-style OFX (without closing tags)

## Usage

1. Upload your OFX file through the web interface
2. Money 99 Savior will process and clean the file
3. View your transactions in the browser
4. Download the cleaned OFX file for use with Microsoft Money 99

## Compatibility

Money 99 Savior has been tested with:
- Microsoft Money 99
- OFX files from major banks and financial institutions
- File formats: .ofx, .qfx, and .qbo

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests if you have suggestions for improvements to help keep Money 99 alive and working in the modern era.

## Support

If you encounter any issues or have questions about using Money 99 Savior, please email me directly at stephenjoly99@gmail.com

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgements

Thanks to all the users who have tested Money 99 Savior and provided feedback to make it more robust and compatible with various financial institutions' OFX formats.

---

**Note**: Money 99 Savior does not store your financial data. All processing happens locally in your browser, keeping your financial information private and secure.
