import { describe, expect, it } from "vitest"
import { catalogUnitPrice, lineCost, projectCost } from "./pricing"

describe("catalog unit price", () => {
  it("converts a kg profile into a price per meter", () => {
    const perMeter = catalogUnitPrice({
      unit: "kg",
      pricePerKg: 25,
      kgPerMeter: 2.15,
    })
    expect(perMeter).toBeCloseTo(53.75, 5)
    expect(lineCost(4, perMeter)).toBeCloseTo(215, 5)
  })

  it("splits a pack into a price per screw", () => {
    expect(catalogUnitPrice({ unit: "pack", packPrice: 100, packQty: 100 })).toBe(1)
    expect(lineCost(20, 1)).toBe(20)
  })

  it("uses the entered price for a meter item", () => {
    expect(catalogUnitPrice({ unit: "meter", pricePerUnit: 40 })).toBe(40)
    expect(lineCost(3.5, 40)).toBe(140)
  })
})

describe("project cost", () => {
  it("adds a percentage overhead on materials and computes margin", () => {
    const result = projectCost({
      lines: [
        { category: "profiles", quantity: 4, unitPrice: 50 },
        { category: "screws", quantity: 20, unitPrice: 1 },
        { category: "labor", quantity: 2, unitPrice: 150 },
        { category: "transport", quantity: 1, unitPrice: 300 },
      ],
      overheads: [{ kind: "percent_materials", percent: 5 }],
      sellingPrice: 1000,
      vatRate: 18,
      includeVat: false,
    })

    expect(result.materials).toBe(200)
    expect(result.screws).toBe(20)
    expect(result.labor).toBe(300)
    expect(result.overheads).toBe(310)
    expect(result.total).toBe(830)
    expect(result.profit).toBe(170)
    expect(result.marginPercent).toBeCloseTo(17, 5)
  })

  it("leaves margin empty when there is no selling price", () => {
    const result = projectCost({
      lines: [{ category: "screws", quantity: 20, unitPrice: 1 }],
      overheads: [],
      sellingPrice: null,
      vatRate: 18,
      includeVat: false,
    })
    expect(result.total).toBe(20)
    expect(result.profit).toBeNull()
    expect(result.marginPercent).toBeNull()
  })

  it("adds Israeli VAT only when the totals include it", () => {
    const result = projectCost({
      lines: [{ category: "screws", quantity: 20, unitPrice: 1 }],
      overheads: [{ kind: "fixed", amount: 0 }],
      sellingPrice: 100,
      vatRate: 18,
      includeVat: true,
    })
    expect(result.subtotal).toBe(20)
    expect(result.vatAmount).toBeCloseTo(3.6, 5)
    expect(result.total).toBeCloseTo(23.6, 5)
    expect(result.profit).toBeCloseTo(76.4, 5)
    expect(result.marginPercent).toBeCloseTo(76.4, 5)
  })
})
