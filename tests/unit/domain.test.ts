import { describe, expect, it } from 'vitest';
import { EmailAddress, PhoneNumber } from '../../src/core/value-objects/contact';
import { DocumentNumber, Slug } from '../../src/core/value-objects/identifiers';
import { roleAtLeast } from '../../src/core/entities';
import { ValidationError } from '../../src/core/errors';
import { buildVCard } from '../../src/application/use-cases/staff-cards';
import { assertPasswordStrength } from '../../src/application/use-cases/auth';
import { buildLeadReference } from '../../src/application/use-cases/leads';

describe('EmailAddress', () => {
  it('normalises case and trims', () => {
    expect(EmailAddress.create('  Admin@MerSam.COM ').value).toBe('admin@mersam.com');
  });

  it('rejects anything that is not an address', () => {
    for (const bad of ['', 'nope', 'a@b', 'a b@c.com', '@mersam.com']) {
      expect(() => EmailAddress.create(bad)).toThrow(ValidationError);
    }
  });

  it('tryCreate returns null rather than throwing', () => {
    expect(EmailAddress.tryCreate('nope')).toBeNull();
    expect(EmailAddress.tryCreate(null)).toBeNull();
    expect(EmailAddress.tryCreate('a@b.com')?.domain).toBe('b.com');
  });
});

describe('PhoneNumber', () => {
  it('accepts the shapes Ghanaian numbers are written in', () => {
    for (const input of ['0551830101', '+233551830101', '233 55 183 0101', '00233551830101']) {
      expect(PhoneNumber.create(input).e164).toBe('+233551830101');
    }
  });

  it('formats the national form for display', () => {
    expect(PhoneNumber.create('0551830101').formatInternational()).toBe('+233 55 183 0101');
  });

  it('exposes digits only for a wa.me link', () => {
    expect(PhoneNumber.create('0551830101').whatsappHandle).toBe('233551830101');
  });

  it('rejects something too short to be a number', () => {
    expect(() => PhoneNumber.create('123')).toThrow(ValidationError);
  });
});

describe('Slug', () => {
  it('reduces a name to a web address', () => {
    expect(Slug.create('Reverse Osmosis Water Treatment').value).toBe(
      'reverse-osmosis-water-treatment',
    );
    expect(Slug.create("MerSam's Borehole & Drilling!!").value).toBe('mersams-borehole-drilling');
  });

  it('rejects a name that reduces to nothing', () => {
    expect(() => Slug.create('!!!')).toThrow(ValidationError);
  });
});

describe('DocumentNumber', () => {
  const october = new Date(Date.UTC(2026, 9, 16, 12));

  it('numbers an invoice by its issue date', () => {
    expect(DocumentNumber.invoice(october, 1)).toBe('161026');
    expect(DocumentNumber.invoice(october, 2)).toBe('161026-2');
  });

  it('derives the customer reference the way the office writes it', () => {
    // "Mr." is a courtesy title, so EBO supplies the letters.
    expect(DocumentNumber.customerReference('MR. EBO', '161026')).toBe('EB/161026');
    expect(DocumentNumber.customerReference('Kwame Mensah', '161026')).toBe('KM/161026');
    expect(DocumentNumber.customerReference('Shola', '040126')).toBe('SH/040126');
    expect(DocumentNumber.customerReference('', '040126')).toBe('MS/040126');
  });

  it('numbers a work report by year and sequence', () => {
    expect(DocumentNumber.workReport(2026, 1)).toBe('MS/2026/001');
    expect(DocumentNumber.workReport(2026, 42)).toBe('MS/2026/042');
  });
});

describe('roles', () => {
  it('treats a higher role as implying the lower ones', () => {
    expect(roleAtLeast('owner', 'admin')).toBe(true);
    expect(roleAtLeast('admin', 'staff')).toBe(true);
    expect(roleAtLeast('staff', 'admin')).toBe(false);
    expect(roleAtLeast('viewer', 'staff')).toBe(false);
  });
});

describe('password strength', () => {
  it('requires length and variety', () => {
    expect(() => assertPasswordStrength('short')).toThrow(ValidationError);
    expect(() => assertPasswordStrength('alllowercaseonly')).toThrow(ValidationError);
    expect(() => assertPasswordStrength('Str0ng!Example#Pass')).not.toThrow();
  });
});

describe('lead reference', () => {
  it('is padded and year scoped', () => {
    expect(buildLeadReference(2026, 7)).toBe('ENQ-2026-0007');
  });
});

describe('vCard', () => {
  const card = {
    slug: 'ama-boateng',
    name: 'Ama Boateng',
    jobTitle: 'Lead Hydrogeologist',
    email: 'ama@mersam.com',
    phone: '+233551830101',
    whatsapp: '+233244607788',
    bio: 'Surveys and borehole siting.',
    location: 'Accra, Ghana',
    linkedinUrl: 'https://linkedin.com/in/ama',
    specialities: ['Surveys'],
    avatarUrl: null,
  };

  const vcard = buildVCard(card, {
    name: 'MerSam',
    url: 'https://mersam.com',
    address: 'Spintex Road, Accra',
  });

  it('is a well formed vCard 3.0 with CRLF line endings', () => {
    expect(vcard.startsWith('BEGIN:VCARD\r\nVERSION:3.0')).toBe(true);
    expect(vcard.trimEnd().endsWith('END:VCARD')).toBe(true);
    expect(vcard.includes('\r\n')).toBe(true);
  });

  it('splits the name and carries the company details', () => {
    expect(vcard).toContain('N:Boateng;Ama;;;');
    expect(vcard).toContain('FN:Ama Boateng');
    expect(vcard).toContain('ORG:MerSam');
    expect(vcard).toContain('TITLE:Lead Hydrogeologist');
    expect(vcard).toContain('TEL;TYPE=CELL,WORK:+233551830101');
    expect(vcard).toContain('URL:https://mersam.com/card/ama-boateng');
  });

  it('escapes the characters the format reserves', () => {
    const escaped = buildVCard(
      { ...card, bio: 'Drilling; surveys, and testing' },
      { name: 'MerSam', url: 'https://mersam.com', address: '' },
    );
    expect(escaped).toContain('NOTE:Drilling\\; surveys\\, and testing');
  });

  it('leaves out a second number when it matches the first', () => {
    const single = buildVCard(
      { ...card, whatsapp: card.phone },
      { name: 'MerSam', url: 'https://mersam.com', address: '' },
    );
    expect(single.match(/TEL;/g)).toHaveLength(1);
  });
});
