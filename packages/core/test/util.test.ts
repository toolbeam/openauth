import { expect, test } from "bun:test";
import { isDomainMatch } from "../src/util";

test("isDomainMatch", () => {
  // Basic matches
  expect(isDomainMatch("example.com", "example.com")).toBe(true);
  expect(isDomainMatch("sub.example.com", "example.com")).toBe(true);
  expect(isDomainMatch("a.example.com", "b.example.com")).toBe(true);

  // Local hostnames
  expect(isDomainMatch("romulus", "romulus")).toBe(true);
  expect(isDomainMatch("romulus", "remus")).toBe(false);
  expect(isDomainMatch("localhost", "localhost")).toBe(true);
  expect(isDomainMatch("server", "server.local")).toBe(false);

  // Two-part TLDs
  expect(isDomainMatch("example.co.uk", "example.co.uk")).toBe(true);
  expect(isDomainMatch("sub.example.co.uk", "example.co.uk")).toBe(true);
  expect(isDomainMatch("evil.co.uk", "bank.co.uk")).toBe(false);
  expect(isDomainMatch("example.com.au", "example.com.au")).toBe(true);

  // Attack vectors
  // Attempt to match on TLD only
  expect(isDomainMatch("evil.com", "bank.com")).toBe(false);
  expect(isDomainMatch("evil.co.uk", "bank.co.uk")).toBe(false);

  // Subdomain attacks
  expect(isDomainMatch("evil.com.attacker.com", "evil.com")).toBe(false);
  expect(isDomainMatch("bank.co.uk.attacker.com", "bank.co.uk")).toBe(false);
  expect(isDomainMatch("example.com.evil.com", "example.com")).toBe(false);

  // Prefix attacks
  expect(isDomainMatch("myexample.com", "example.com")).toBe(false);
  expect(isDomainMatch("exampleevilsite.com", "example.com")).toBe(false);

  // Double-dot attacks
  expect(isDomainMatch("example..com", "example.com")).toBe(false);
  expect(isDomainMatch("evil..co..uk", "bank.co.uk")).toBe(false);

  // Empty parts attacks
  expect(isDomainMatch("example.com.", "example.com")).toBe(false);

  // Mixed case attacks
  expect(isDomainMatch("EXAMPLE.COM", "example.com")).toBe(false);
  expect(isDomainMatch("Example.Co.Uk", "example.co.uk")).toBe(false);

  // IP address attempts
  expect(isDomainMatch("127.0.0.1", "localhost")).toBe(false);
  expect(isDomainMatch("192.168.1.1", "192.168.1.1")).toBe(true);

  // Special character attacks
  expect(isDomainMatch("exam%70le.com", "example.com")).toBe(false);
  expect(isDomainMatch("exam\u0000ple.com", "example.com")).toBe(false);

  // Unicode/punycode attacks
  expect(isDomainMatch("xn--e1awd7f.com", "example.com")).toBe(false);
  expect(isDomainMatch("еxample.com", "example.com")).toBe(false); // cyrillic 'е'

  // Edge cases
  expect(isDomainMatch("", "")).toBe(true); // empty strings
  expect(isDomainMatch(" ", " ")).toBe(true); // spaces
  expect(isDomainMatch("example.com", "")).toBe(false); // empty vs non-empty
  expect(isDomainMatch("com", "com")).toBe(true); // single part
  expect(isDomainMatch(".com", "com")).toBe(false); // dot prefix

  // Mixed TLD tests
  expect(isDomainMatch("example.co.uk.com", "example.co.uk")).toBe(false);
  expect(isDomainMatch("example.com.co.uk", "example.co.uk")).toBe(false);
});
