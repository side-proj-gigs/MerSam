import { ValidationError } from '../errors';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class EmailAddress {
  private constructor(readonly value: string) {}

  static create(raw: string): EmailAddress {
    const normalised = raw.trim().toLowerCase();
    if (!EMAIL_SHAPE.test(normalised) || normalised.length > 254) {
      throw new ValidationError(`"${raw}" is not a usable email address`);
    }
    return new EmailAddress(normalised);
  }

  static tryCreate(raw: string | null | undefined): EmailAddress | null {
    if (!raw) return null;
    try {
      return EmailAddress.create(raw);
    } catch {
      return null;
    }
  }

  get domain(): string {
    return this.value.slice(this.value.indexOf('@') + 1);
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Ghanaian numbers arrive in several shapes: 0551830101, +233551830101 and
 * 233 55 183 0101 all describe the same line. We keep E.164 internally and
 * render the spaced national form in the UI.
 */
export class PhoneNumber {
  private constructor(readonly e164: string) {}

  static create(raw: string, defaultCountry = '233'): PhoneNumber {
    const digitsOnly = raw.replace(/[^\d+]/g, '');
    let digits = digitsOnly.startsWith('+') ? digitsOnly.slice(1) : digitsOnly;

    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = defaultCountry + digits.slice(1);
    if (!digits.startsWith(defaultCountry) && digits.length <= 10) {
      digits = defaultCountry + digits;
    }

    if (digits.length < 10 || digits.length > 15) {
      throw new ValidationError(`"${raw}" is not a usable phone number`);
    }
    return new PhoneNumber(`+${digits}`);
  }

  static tryCreate(raw: string | null | undefined): PhoneNumber | null {
    if (!raw) return null;
    try {
      return PhoneNumber.create(raw);
    } catch {
      return null;
    }
  }

  /** "+233 55 183 0101" */
  formatInternational(): string {
    const digits = this.e164.slice(1);
    if (digits.startsWith('233') && digits.length === 12) {
      const n = digits.slice(3);
      return `+233 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
    }
    return this.e164;
  }

  /** Digits only, which is what wa.me links expect. */
  get whatsappHandle(): string {
    return this.e164.slice(1);
  }

  toString(): string {
    return this.e164;
  }
}
