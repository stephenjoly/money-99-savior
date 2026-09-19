import { describe, it, expect } from 'vitest';
import {
  processOfxFile,
  validateFileType,
  computeNameEdits,
  getMerchantRules,
  validateMerchantRules,
} from '../src/utils/ofxProcessor';

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

describe('computeNameEdits', () => {
  it('returns no edits for a name nothing applies to', () => {
    const { edits, finalName } = computeNameEdits('SHELL C36284');

    expect(edits).toEqual([]);
    expect(finalName).toBe('SHELL C36284');
  });

  it('records a merchant rename with the rule that matched', () => {
    const { edits, finalName } = computeNameEdits('AMZN MKTP US1234567 WWWAMAZONC');

    expect(finalName).toBe('AMAZON');
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({
      kind: 'renamed',
      from: 'AMZN MKTP US1234567 WWWAMAZONC',
      to: 'AMAZON',
      rule: 'AMZN MKTP [A-Z0-9]+ WWWAMAZONC',
    });
  });

  it('records a shortening when the name is still over 32 characters', () => {
    const { edits, finalName } = computeNameEdits(
      'A VERY LONG MERCHANT NAME THAT IS OVER THIRTY TWO CHARACTERS'
    );

    expect(finalName).toBe('A VERY LONG MERCHANT NAME THAT I');
    expect(edits).toHaveLength(1);
    expect(edits[0].kind).toBe('shortened');
  });

  it('records a rename and a shortening in the order they were applied', () => {
    const { edits, finalName } = computeNameEdits(
      'COSTCO WHOLESALE W12345 LONGNAME THAT EXCEEDS THIRTY TWO CHARS'
    );

    expect(edits.map((e) => e.kind)).toEqual(['renamed', 'shortened']);
    expect(edits[0].to).toBe('COSTCO LONGNAME THAT EXCEEDS THIRTY TWO CHARS');
    expect(edits[1].to).toBe('COSTCO LONGNAME THAT EXCEEDS THI');
    expect(finalName).toBe('COSTCO LONGNAME THAT EXCEEDS THI');
  });

  it('records ampersand removal as a rename', () => {
    const { edits, finalName } = computeNameEdits('AT&T STORE');

    expect(finalName).toBe('ATT STORE');
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ kind: 'renamed', rule: '&' });
  });

  it('does not carry regex lastIndex between calls', () => {
    const first = computeNameEdits('AMZN MKTP US1234567 WWWAMAZONC');
    const second = computeNameEdits('AMZN MKTP US7654321 WWWAMAZONC');

    expect(first.finalName).toBe('AMAZON');
    expect(second.finalName).toBe('AMAZON');
  });
});

describe('per-transaction edits', () => {
  it('attaches the edit trail to the transaction it happened to', async () => {
    const result = await processOfxFile(Buffer.from(sgmlFile));

    expect(result.transactions[0].edits?.map((e) => e.kind)).toEqual([
      'renamed',
      'shortened',
    ]);
    expect(result.transactions[0].edits?.[0].from).toBe(
      'COSTCO WHOLESALE W12345 LONGNAME THAT EXCEEDS THIRTY TWO CHARS'
    );

    expect(result.transactions[1].edits).toHaveLength(1);
    expect(result.transactions[1].edits?.[0]).toMatchObject({
      kind: 'renamed',
      to: 'AMAZON',
    });
  });

  it('leaves untouched transactions without an edits key', async () => {
    const content =
      'OFXHEADER:100\n<OFX><STMTTRN>\n<TRNTYPE>DEBIT\n<FITID>1\n<NAME>SHORT NAME\n</STMTTRN></OFX>';
    const result = await processOfxFile(Buffer.from(content));

    expect(result.transactions[0].name).toBe('SHORT NAME');
    expect(result.transactions[0].edits).toBeUndefined();
  });

  // Names are compared trimmed: a cut that lands on a space leaves the edit's
  // `to` with trailing whitespace that extraction strips back off.
  it('agrees with the final name written into the processed file', async () => {
    const result = await processOfxFile(Buffer.from(sgmlFile));

    for (const transaction of result.transactions) {
      const lastEdit = transaction.edits?.[transaction.edits.length - 1];
      if (lastEdit) {
        expect(lastEdit.to.trim()).toBe(transaction.name);
      }
    }
  });

  it('keeps a shortening reversible when the cut lands on a space', async () => {
    const content = [
      'OFXHEADER:100',
      '<OFX><STMTTRN>',
      '<TRNTYPE>DEBIT',
      '<FITID>1',
      '<NAME>HYDRO ONE PREAUTHORIZED PAYMENT AUG',
      '</STMTTRN></OFX>',
    ].join('\n');
    const result = await processOfxFile(Buffer.from(content));
    const edit = result.transactions[0].edits?.[0];

    expect(edit?.kind).toBe('shortened');
    // head + tail must reconstruct the original exactly, spaces included.
    expect(edit!.to + edit!.from.slice(edit!.to.length)).toBe(edit!.from);
    expect(edit!.to).toHaveLength(32);
  });
});

describe('getMerchantRules', () => {
  it('exposes the rename rules as plain strings for the rules page', () => {
    const rules = getMerchantRules();

    expect(rules.length).toBeGreaterThan(0);
    expect(rules).toContainEqual({
      pattern: 'COSTCO WHOLESALE W\\d+',
      replacement: 'COSTCO',
    });
    for (const rule of rules) {
      expect(typeof rule.pattern).toBe('string');
      expect(typeof rule.replacement).toBe('string');
    }
  });

  it('returns a copy so callers cannot mutate the defaults', () => {
    const first = getMerchantRules();
    first[0].replacement = 'MUTATED';

    expect(getMerchantRules()[0].replacement).not.toBe('MUTATED');
  });
});

describe('validateMerchantRules', () => {
  it('accepts a well-formed rule list', () => {
    const rules = validateMerchantRules([
      { pattern: 'AMZN MKTP US\\d+', replacement: 'AMAZON' },
      { pattern: '^SQ \\*', replacement: 'SQUARE' },
    ]);

    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual({ pattern: 'AMZN MKTP US\\d+', replacement: 'AMAZON' });
  });

  it('rejects a non-array', () => {
    expect(() => validateMerchantRules({ pattern: 'X', replacement: 'Y' })).toThrow(/array/i);
  });

  it('rejects an entry without a pattern or replacement', () => {
    expect(() => validateMerchantRules([{ replacement: 'X' }])).toThrow(/pattern/i);
    expect(() => validateMerchantRules([{ pattern: 'X' }])).toThrow(/replacement/i);
  });

  it('rejects an invalid regular expression', () => {
    expect(() => validateMerchantRules([{ pattern: '(unclosed', replacement: 'X' }])).toThrow(
      /valid pattern/i
    );
  });

  it('rejects an empty pattern', () => {
    expect(() => validateMerchantRules([{ pattern: '', replacement: 'X' }])).toThrow(/pattern/i);
  });

  it('rejects an over-long pattern', () => {
    const pattern = 'A'.repeat(201);

    expect(() => validateMerchantRules([{ pattern, replacement: 'X' }])).toThrow(/too long/i);
  });

  it('rejects nested repetition that could hang processing', () => {
    expect(() => validateMerchantRules([{ pattern: '(A+)+', replacement: 'X' }])).toThrow(
      /nested repetition/i
    );
    expect(() => validateMerchantRules([{ pattern: '(\\w*)*X', replacement: 'Y' }])).toThrow(
      /nested repetition/i
    );
  });
});

describe('custom merchant rules', () => {
  const fileWith = (name: string) =>
    Buffer.from(
      [
        'OFXHEADER:100',
        '<OFX><STMTTRN>',
        '<TRNTYPE>DEBIT',
        '<FITID>1',
        `<NAME>${name}`,
        '</STMTTRN></OFX>',
      ].join('\n')
    );

  it('applies a caller-supplied rule instead of the defaults', async () => {
    const result = await processOfxFile(fileWith('SQ *MY LOCAL CAFE'), [
      { pattern: '^SQ \\*', replacement: 'SQUARE ' },
    ]);

    expect(result.transactions[0].name).toBe('SQUARE MY LOCAL CAFE');
    expect(result.transactions[0].edits?.[0]).toMatchObject({
      kind: 'renamed',
      rule: '^SQ \\*',
    });
  });

  it('does not apply the defaults when a caller list is given', async () => {
    const result = await processOfxFile(fileWith('AMZN MKTP US1234567 WWWAMAZONC'), [
      { pattern: 'NOPE', replacement: 'NOPE' },
    ]);

    expect(result.transactions[0].name).toBe('AMZN MKTP US1234567 WWWAMAZONC');
    expect(result.transactions[0].edits).toBeUndefined();
  });

  it('only touches NAME values, never other tags', async () => {
    const result = await processOfxFile(fileWith('GROCERY MART'), [
      { pattern: 'DEBIT', replacement: 'HACKED' },
    ]);

    expect(result.processedContent).toContain('<TRNTYPE>DEBIT');
    expect(result.transactions[0].type).toBe('DEBIT');
    expect(result.transactions[0].name).toBe('GROCERY MART');
  });

  it('reports per-rule usage counts and examples', async () => {
    const result = await processOfxFile(Buffer.from(sgmlFile), [
      { pattern: 'COSTCO WHOLESALE W\\d+', replacement: 'COSTCO' },
      { pattern: 'NEVER MATCHES', replacement: 'X' },
    ]);

    expect(result.processingStats.ruleStats).toEqual([
      {
        pattern: 'COSTCO WHOLESALE W\\d+',
        count: 1,
        examples: ['COSTCO WHOLESALE W12345 LONGNAME THAT EXCEEDS THIRTY TWO CHARS'],
      },
    ]);
  });
});
