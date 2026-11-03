import { ValidationError } from '../errors';

export class Slug {
  private constructor(readonly value: string) {}

  static create(raw: string): Slug {
    const slug = Slug.normalise(raw);
    if (slug.length < 2 || slug.length > 96) {
      throw new ValidationError(`"${raw}" does not reduce to a usable slug`);
    }
    return new Slug(slug);
  }

  static normalise(raw: string): string {
    return raw
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  toString(): string {
    return this.value;
  }
}

/**
 * MerSam numbers invoices by the day they were raised (161026 for 16 October
 * 2026) and adds a suffix when more than one invoice is raised that day. Work
 * reports use the MS/YYYY/NNN form shown on the signed template.
 */
export const DocumentNumber = {
  invoice(issuedOn: Date, sameDaySequence: number): string {
    const dd = String(issuedOn.getUTCDate()).padStart(2, '0');
    const mm = String(issuedOn.getUTCMonth() + 1).padStart(2, '0');
    const yy = String(issuedOn.getUTCFullYear()).slice(-2);
    const base = `${dd}${mm}${yy}`;
    return sameDaySequence <= 1 ? base : `${base}-${sameDaySequence}`;
  },

  /**
   * "EB/161026" from the customer name and the invoice number. Courtesy titles
   * are skipped, so "Mr. Ebo" reduces to EB rather than ME, which is how the
   * office has always written these references.
   */
  customerReference(customerName: string, invoiceNumber: string): string {
    const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'rev', 'eng', 'nana']);
    const words = customerName
      .replace(/[^a-zA-Z ]/g, '')
      .split(/\s+/)
      .filter((word) => word && !TITLES.has(word.toLowerCase()));

    const initials =
      words.length >= 2
        ? words.slice(0, 2).map((word) => word[0]!.toUpperCase()).join('')
        : (words[0] ?? '').slice(0, 2).toUpperCase();

    return `${initials || 'MS'}/${invoiceNumber}`;
  },

  workReport(year: number, sequence: number): string {
    return `MS/${year}/${String(sequence).padStart(3, '0')}`;
  },
};
