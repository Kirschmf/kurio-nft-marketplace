const WEI = 10n ** 18n;

export function toWei(eth: string): bigint {
  if (!/^\d+(\.\d{1,18})?$/.test(eth))
    throw new Error("Valor em ETH inválido.");
  const [whole, fraction = ""] = eth.split(".");
  return BigInt(whole) * WEI + BigInt(fraction.padEnd(18, "0"));
}

export function fromWei(wei: bigint): string {
  if (wei < 0n) throw new Error("Valor em ETH negativo.");
  const fraction = (wei % WEI).toString().padStart(18, "0").replace(/0+$/, "");
  return `${wei / WEI}${fraction ? `.${fraction}` : ""}`;
}

export function formatEth(eth: string): string {
  return `${fromWei(toWei(eth))} ETH`;
}

export function calculateTotals(
  lines: { unitPriceEth: string; quantity: number }[],
  discountBps = 0,
  feeEth = "0.016",
) {
  const subtotal = lines.reduce(
    (sum, line) => sum + toWei(line.unitPriceEth) * BigInt(line.quantity),
    0n,
  );
  const discount = (subtotal * BigInt(discountBps)) / 10_000n;
  const fee = lines.length ? toWei(feeEth) : 0n;
  return {
    subtotalEth: fromWei(subtotal),
    discountEth: fromWei(discount),
    networkFeeEth: fromWei(fee),
    totalEth: fromWei(subtotal - discount + fee),
  };
}
