import { describe, it, expect } from 'vitest';
import { processOfxFile, validateFileType } from '../src/utils/ofxProcessor';

const sgmlFile = [
  'OFXHEADER:100',
  'DATA:OFXSGML',
  'VERSION:102',
  '',
  '<OFX>',
  '<BANKMSGSRSV1>',
  '<STMTTRNRS>',
  '<STMTRS>',
  '<BANKTRANLIST>',
  '<STMTTRN>',
  '<TRNTYPE>DEBIT',
  '<DTPOSTED>20240101120000',
  '<TRNAMT>-42.99',
  '<FITID>2024010101',
  '<NAME>COSTCO WHOLESALE W12345 LONGNAME THAT EXCEEDS THIRTY TWO CHARS',
  '<SIC>5961',
  '</STMTTRN>',
  '<STMTTRN>',
  '<TRNTYPE>CREDIT',
  '<DTPOSTED>20240102120000',
  '<TRNAMT>1500.00',
  '<FITID>2024010201',
  '<NAME>AMZN MKTP US1234567 WWWAMAZONC',
  '</STMTTRN>',
  '</BANKTRANLIST>',
  '</STMTRS>',
  '</STMTTRNRS>',
  '</BANKMSGSRSV1>',
  '</OFX>',
].join('\n');

const xmlFile = `<?xml version="1.0" standalone="no"?><OFX OFXHEADER="200" VERSION="202" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20240101</DTPOSTED>
<TRNAMT>-10.00</TRNAMT>
<FITID>1</FITID>
<NAME>A VERY LONG MERCHANT NAME THAT IS OVER THIRTY TWO CHARACTERS</NAME>
<SIC>5961</SIC>
<CORRECTFITID>XYZ</CORRECTFITID>
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('extractTransactions', () => {
  it('extracts transactions from SGML-style OFX', async () => {
    const result = await processOfxFile(Buffer.from(sgmlFile));

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({
      type: 'DEBIT',
      date: '20240101120000',
      amount: -42.99,
      id: '2024010101',
    });
    expect(result.transactions[1]).toMatchObject({
      type: 'CREDIT',
      amount: 1500,
      id: '2024010201',
    });
  });

  it('extracts transactions from XML-style OFX with closing tags', async () => {
    const result = await processOfxFile(Buffer.from(xmlFile));

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      type: 'DEBIT',
      date: '20240101',
      amount: -10,
      id: '1',
    });
  });
});

describe('header conversion', () => {
  it('converts modern XML OFX headers to the Money 99 SGML header', async () => {
    const result = await processOfxFile(Buffer.from(xmlFile));

    expect(result.processedContent.startsWith('OFXHEADER:100')).toBe(true);
    expect(result.processedContent).not.toContain('<?xml version=');
  });
});

describe('merchant replacements', () => {
  it('standardizes Amazon, Costco, and Presto names', async () => {
    const result = await processOfxFile(Buffer.from(sgmlFile));
    const names = result.transactions.map((t) => t.name);

    expect(names).toContain('AMAZON');
    expect(names[0].startsWith('COSTCO')).toBe(true);
    expect(names[0]).not.toContain('WHOLESALE');
  });

  it('strips ampersands', async () => {
    const content = 'OFXHEADER:100\n<OFX><STMTTRN>\n<TRNTYPE>DEBIT\n<NAME>AT&T STORE\n</STMTTRN></OFX>';
    const result = await processOfxFile(Buffer.from(content));

    expect(result.transactions[0].name).toBe('ATT STORE');
  });
});

describe('NAME truncation', () => {
  it('truncates SGML-style names to 32 characters and records the change', async () => {
    const result = await processOfxFile(Buffer.from(sgmlFile));

    expect(result.transactions[0].name).toBe('COSTCO LONGNAME THAT EXCEEDS THI');
    expect(result.transactions[0].name).toHaveLength(32);
    expect(result.processingStats.truncatedNames).toContainEqual({
      original: 'COSTCO LONGNAME THAT EXCEEDS THIRTY TWO CHARS',
      truncated: 'COSTCO LONGNAME THAT EXCEEDS THI',
    });
  });

  it('truncates XML-style names to 32 characters', async () => {
    const result = await processOfxFile(Buffer.from(xmlFile));

    expect(result.transactions[0].name).toBe('A VERY LONG MERCHANT NAME THAT I');
    expect(result.transactions[0].name).toHaveLength(32);
  });

  it('leaves short names untouched', async () => {
    const content = 'OFXHEADER:100\n<OFX><STMTTRN>\n<TRNTYPE>DEBIT\n<NAME>SHORT NAME\n</STMTTRN></OFX>';
    const result = await processOfxFile(Buffer.from(content));

    expect(result.transactions[0].name).toBe('SHORT NAME');
    expect(result.processingStats.truncatedNames).toHaveLength(0);
  });
});

describe('unwanted tag removal', () => {
  it('removes SIC and CORRECTFITID tags', async () => {
    const result = await processOfxFile(Buffer.from(xmlFile));

    expect(result.processedContent).not.toContain('<SIC>');
    expect(result.processedContent).not.toContain('CORRECTFITID');
    expect(result.processingStats.removedTags).toEqual(
      expect.arrayContaining([
        { tagName: 'SIC', count: 1 },
        { tagName: 'CORRECTFITID', count: 1 },
      ])
    );
  });
});

describe('validateFileType', () => {
  it('accepts OFX, QFX, and QBO extensions case-insensitively', () => {
    expect(validateFileType('statement.ofx')).toBe(true);
    expect(validateFileType('statement.qfx')).toBe(true);
    expect(validateFileType('statement.qbo')).toBe(true);
    expect(validateFileType('statement.OFX')).toBe(true);
  });

  it('rejects other extensions', () => {
    expect(validateFileType('statement.txt')).toBe(false);
    expect(validateFileType('statement')).toBe(false);
    expect(validateFileType('statement.csv')).toBe(false);
  });
});
