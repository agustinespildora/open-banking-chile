import { describe, it, expect } from "vitest";
import { MOVEMENT_SOURCE } from "../types.js";
import { billedStatementMovements } from "./bchile.js";

/**
 * Recorte real de `tarjetas/estadocuenta/nacional/resumen-por-fecha`
 * (facturación 23/07/2026), con los campos que usa el parser.
 *
 * El orden importa: "TOTAL TARJETA …" viene entre los movimientos y la sección
 * de cargos, comisiones, impuestos e intereses, así que es justo la fila que
 * cortaba el recorrido.
 */
const resumenNacional = {
  existeEstadoCuenta: true,
  seccionOperaciones: {
    transaccionesTarjetas: [
      { fechaTransaccionString: "10/07/2026", montoTransaccion: 17411, descripcion: "MONTO CANCELADO", cuotas: "01/01", grupo: "pagos", totales: false, cambioTarjeta: false },
      { fechaTransaccionString: "23/07/2026", montoTransaccion: 17411, descripcion: "TOTAL PAGOS A LA CUENTA", cuotas: "01/01", grupo: "pagos", totales: true, cambioTarjeta: false },
      { fechaTransaccionString: "19/07/2026", montoTransaccion: 17209, descripcion: "PAYU *UBER EATS SANTIAGO", cuotas: "01/01", grupo: "avancesCompras", totales: false, cambioTarjeta: false },
      { fechaTransaccionString: null, montoTransaccion: 69402, descripcion: "TOTAL TARJETA XXXXXXXXXXXX3591", cuotas: "01/01", grupo: "avancesCompras", totales: false, cambioTarjeta: true },
      { fechaTransaccionString: "23/07/2026", montoTransaccion: 0, descripcion: "TOTAL COMPRAS EN CUOTAS A LA CUENTA", cuotas: "01/01", grupo: "cuotas", totales: true, cambioTarjeta: false },
    ],
  },
  seccionCargosImpuestosAbonos: {
    transaccionesTarjetas: [
      { fechaTransaccionString: "08/07/2026", montoTransaccion: 90498, descripcion: "TRASPASO DEUDA INTERNACIONAL", cuotas: "01/01", grupo: "generico", totales: false, cambioTarjeta: false },
      { fechaTransaccionString: "08/07/2026", montoTransaccion: 245, descripcion: "IMPUESTO DECRETO LEY 3475 TASA 0,066 %", cuotas: "01/01", grupo: "generico", totales: false, cambioTarjeta: false },
      { fechaTransaccionString: "23/07/2026", montoTransaccion: 2859, descripcion: "COMISION ADMINISTRACION MENSUAL", cuotas: "01/01", grupo: "generico", totales: false, cambioTarjeta: false },
      { fechaTransaccionString: "23/07/2026", montoTransaccion: 9773, descripcion: "INTERESES ROTATIVOS", cuotas: "01/01", grupo: "generico", totales: false, cambioTarjeta: false },
      { fechaTransaccionString: "23/07/2026", montoTransaccion: 32, descripcion: "INTERES DE MORA", cuotas: "01/01", grupo: "generico", totales: false, cambioTarjeta: false },
    ],
  },
};

describe("billedStatementMovements", () => {
  it("keeps the fee, tax and interest section after a dateless per-card total", () => {
    const { movements } = billedStatementMovements(resumenNacional, "****3591");
    expect(movements.map((m) => [m.description, m.amount])).toEqual([
      ["MONTO CANCELADO", 17411],
      ["PAYU *UBER EATS SANTIAGO", -17209],
      ["TRASPASO DEUDA INTERNACIONAL", -90498],
      ["IMPUESTO DECRETO LEY 3475 TASA 0,066 %", -245],
      ["COMISION ADMINISTRACION MENSUAL", -2859],
      ["INTERESES ROTATIVOS", -9773],
      ["INTERES DE MORA", -32],
    ]);
  });

  it("drops every subtotal row", () => {
    const { movements } = billedStatementMovements(resumenNacional);
    const descriptions = movements.map((m) => m.description);
    expect(descriptions).not.toContain("TOTAL PAGOS A LA CUENTA");
    expect(descriptions).not.toContain("TOTAL TARJETA XXXXXXXXXXXX3591");
    expect(descriptions).not.toContain("TOTAL COMPRAS EN CUOTAS A LA CUENTA");
  });

  it("reports rows it could not place instead of dropping them silently", () => {
    const { movements, skipped } = billedStatementMovements({
      existeEstadoCuenta: true,
      seccionOperaciones: {
        transaccionesTarjetas: [
          { fechaTransaccionString: null, montoTransaccion: 1000, descripcion: "SIN FECHA", cuotas: "01/01", grupo: "generico" },
          { fechaTransaccionString: "23/07/2026", montoTransaccion: null, descripcion: "SIN MONTO", cuotas: "01/01", grupo: "generico" },
        ],
      },
    });
    expect(movements).toEqual([]);
    expect(skipped).toEqual(["SIN FECHA (sin fecha)", "SIN MONTO (sin monto)"]);
  });

  it("normalizes dates, marks the source and carries the card and currency", () => {
    const { movements } = billedStatementMovements(
      {
        existeEstadoCuenta: true,
        seccionCargosImpuestosAbonos: {
          transaccionesTarjetas: [
            { fechaTransaccionString: "08/07/2026", montoTransaccion: 48.34, descripcion: "CURSOR, AI POWERED IDE", cuotas: "01/01", grupo: "generico" },
          ],
        },
      },
      "****3591",
      "USD",
    );
    expect(movements).toEqual([
      {
        date: "08-07-2026",
        description: "CURSOR, AI POWERED IDE",
        amount: -48.34,
        balance: 0,
        source: MOVEMENT_SOURCE.credit_card_billed,
        card: "****3591",
        installments: "01/01",
        currency: "USD",
      },
    ]);
  });

  it("handles a missing or null section", () => {
    expect(billedStatementMovements({ existeEstadoCuenta: true })).toEqual({ movements: [], skipped: [] });
    expect(
      billedStatementMovements({
        existeEstadoCuenta: true,
        seccionOperaciones: { transaccionesTarjetas: null },
        seccionCargosImpuestosAbonos: {},
      }),
    ).toEqual({ movements: [], skipped: [] });
  });
});
