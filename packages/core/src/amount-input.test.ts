import { describe, expect, it } from "vitest";

import {
  amountInputToNumber,
  amountToInput,
  formatAmountInput,
  isAmountInputComplete,
  pressAmountKey,
  sanitizeAmountInput,
  type AmountKey,
} from "./amount-input";

/** Types a sequence of keys from empty, the way a user would. */
function type(keys: string): string {
  return keys
    .split("")
    .reduce((value, key) => pressAmountKey(value, key as AmountKey), "");
}

describe("pressAmountKey", () => {
  it("builds an amount digit by digit", () => {
    expect(type("1234")).toBe("1234");
  });

  it("keeps at most two decimals", () => {
    expect(type("12.567")).toBe("12.56");
  });

  it("ignores a second decimal point", () => {
    expect(pressAmountKey("12.5", ".")).toBe("12.5");
  });

  it("starts a decimal entry with a leading zero", () => {
    expect(pressAmountKey("", ".")).toBe("0.");
  });

  it("replaces a lone leading zero rather than growing it", () => {
    expect(type("05")).toBe("5");
    expect(type("00")).toBe("0");
  });

  it("keeps zeros that follow a real digit", () => {
    expect(type("100")).toBe("100");
  });

  it("stops accepting integer digits at the cap", () => {
    const atCap = "123456789";
    expect(pressAmountKey(atCap, "1")).toBe(atCap);
  });

  it("still accepts decimals once the integer cap is reached", () => {
    expect(pressAmountKey("123456789", ".")).toBe("123456789.");
  });

  it("removes one character on backspace", () => {
    expect(pressAmountKey("12.5", "backspace")).toBe("12.");
    expect(pressAmountKey("12.", "backspace")).toBe("12");
  });

  it("is a no-op backspacing an empty entry", () => {
    expect(pressAmountKey("", "backspace")).toBe("");
  });

  it("empties the entry on clear", () => {
    expect(pressAmountKey("1234.56", "clear")).toBe("");
  });
});

describe("sanitizeAmountInput", () => {
  it("keeps a well-formed amount intact", () => {
    expect(sanitizeAmountInput("42.50")).toBe("42.50");
  });

  it("accepts a comma as the decimal separator", () => {
    expect(sanitizeAmountInput("42,50")).toBe("42.50");
  });

  it("drops characters a keypad could never send", () => {
    expect(sanitizeAmountInput("€ 1 234.56")).toBe("1234.56");
  });

  it("truncates a pasted value to two decimals", () => {
    expect(sanitizeAmountInput("3.14159")).toBe("3.14");
  });
});

describe("amountInputToNumber", () => {
  it("reads a finished entry", () => {
    expect(amountInputToNumber("12.50")).toBe(12.5);
  });

  it("reads a half-typed decimal as its integer part", () => {
    expect(amountInputToNumber("12.")).toBe(12);
  });

  it("treats an empty entry as zero", () => {
    expect(amountInputToNumber("")).toBe(0);
    expect(amountInputToNumber(".")).toBe(0);
  });
});

describe("isAmountInputComplete", () => {
  it("rejects nothing typed and explicit zero", () => {
    expect(isAmountInputComplete("")).toBe(false);
    expect(isAmountInputComplete("0")).toBe(false);
    expect(isAmountInputComplete("0.00")).toBe(false);
  });

  it("accepts any positive amount", () => {
    expect(isAmountInputComplete("0.01")).toBe(true);
    expect(isAmountInputComplete("12")).toBe(true);
  });
});

describe("amountToInput", () => {
  it("renders a whole amount without trailing zeros", () => {
    expect(amountToInput(42)).toBe("42");
  });

  it("renders cents when there are any", () => {
    expect(amountToInput(42.5)).toBe("42.50");
  });

  it("returns an empty entry for a non-amount", () => {
    expect(amountToInput(0)).toBe("");
    expect(amountToInput(Number.NaN)).toBe("");
  });

  it("round-trips through the keypad representation", () => {
    expect(amountInputToNumber(amountToInput(1234.56))).toBe(1234.56);
  });
});

describe("formatAmountInput", () => {
  it("marks an empty entry so the placeholder can be dimmed", () => {
    expect(formatAmountInput("")).toEqual({
      integer: "0",
      fraction: "",
      empty: true,
    });
  });

  it("groups thousands in the integer part", () => {
    // fr-FR groups with a narrow no-break space.
    expect(formatAmountInput("1234", "fr-FR").integer).toBe("1 234");
    expect(formatAmountInput("1234", "en-GB").integer).toBe("1,234");
  });

  it("keeps a trailing separator visible while typing", () => {
    expect(formatAmountInput("12.", "en-GB").fraction).toBe(".");
  });

  it("uses the locale's decimal separator", () => {
    expect(formatAmountInput("12.5", "fr-FR").fraction).toBe(",5");
    expect(formatAmountInput("12.5", "en-GB").fraction).toBe(".5");
  });
});
