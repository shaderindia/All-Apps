(function (root) {
  'use strict';

  const CURRENCIES = new Set(['RON', 'INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED']);

  function finite(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`${label} must be a valid number.`);
    return number;
  }

  function cleanName(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  }

  function normalizeParticipant(source, index = 0) {
    const name = cleanName(source?.name);
    if (!name) throw new Error(`Person ${index + 1} needs a name.`);
    const spent = finite(source?.spent ?? 0, `${name}'s paid amount`);
    const weight = finite(source?.weight ?? 1, `${name}'s share weight`);
    if (spent < 0 || spent > 1e9) throw new Error(`${name}'s paid amount must be between 0 and 1,000,000,000.`);
    if (weight <= 0 || weight > 1000) throw new Error(`${name}'s share weight must be greater than 0 and no more than 1,000.`);
    return {
      id: String(source?.id || `person-${index + 1}`),
      name,
      spent: Math.round((spent + Number.EPSILON) * 100) / 100,
      weight: Math.round((weight + Number.EPSILON) * 1000) / 1000
    };
  }

  function allocateShares(totalCents, participants) {
    const totalWeight = participants.reduce((sum, person) => sum + person.weight, 0);
    const rawShares = participants.map((person, index) => {
      const raw = totalCents * person.weight / totalWeight;
      const cents = Math.floor(raw);
      return { index, cents, fraction: raw - cents };
    });
    let remaining = totalCents - rawShares.reduce((sum, item) => sum + item.cents, 0);
    [...rawShares]
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
      .slice(0, remaining)
      .forEach(item => { rawShares[item.index].cents++; });
    return rawShares.map(item => item.cents);
  }

  function calculateSettlement(input) {
    if (!Array.isArray(input) || input.length < 2) throw new Error('Add at least two people to calculate a settlement.');
    if (input.length > 30) throw new Error('FairShare supports up to 30 people in one group.');

    const participants = input.map(normalizeParticipant);
    const duplicate = participants.find((person, index) =>
      participants.findIndex(candidate => candidate.name.toLowerCase() === person.name.toLowerCase()) !== index);
    if (duplicate) throw new Error(`The name “${duplicate.name}” is used more than once.`);

    const totalCents = participants.reduce((sum, person) => sum + Math.round(person.spent * 100), 0);
    if (totalCents <= 0) throw new Error('Enter at least one paid amount greater than zero.');

    const shareCents = allocateShares(totalCents, participants);
    const balances = participants.map((person, index) => {
      const spentCents = Math.round(person.spent * 100);
      const balanceCents = spentCents - shareCents[index];
      return {
        ...person,
        spent: spentCents / 100,
        share: shareCents[index] / 100,
        balance: balanceCents / 100,
        status: balanceCents < 0 ? 'Owes' : balanceCents > 0 ? 'Gets back' : 'Settled'
      };
    });

    const debtors = balances
      .filter(person => person.balance < 0)
      .map(person => ({ name: person.name, cents: Math.round(-person.balance * 100) }))
      .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));
    const creditors = balances
      .filter(person => person.balance > 0)
      .map(person => ({ name: person.name, cents: Math.round(person.balance * 100) }))
      .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));

    const payments = [];
    let debtorIndex = 0;
    let creditorIndex = 0;
    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const cents = Math.min(debtor.cents, creditor.cents);
      if (cents > 0) payments.push({ from: debtor.name, to: creditor.name, amount: cents / 100 });
      debtor.cents -= cents;
      creditor.cents -= cents;
      if (debtor.cents === 0) debtorIndex++;
      if (creditor.cents === 0) creditorIndex++;
    }

    const balanceCheck = balances.reduce((sum, person) => sum + Math.round(person.balance * 100), 0);
    if (balanceCheck !== 0) throw new Error('The settlement did not balance. Please review the entered amounts.');

    return {
      total: totalCents / 100,
      average: totalCents / participants.length / 100,
      totalWeight: participants.reduce((sum, person) => sum + person.weight, 0),
      balances,
      payments
    };
  }

  function normalizeCurrency(value) {
    return CURRENCIES.has(value) ? value : 'RON';
  }

  function formatMoney(value, currency = 'RON') {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizeCurrency(currency),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(finite(value, 'Amount'));
  }

  const api = { CURRENCIES, finite, cleanName, normalizeParticipant, allocateShares, calculateSettlement, normalizeCurrency, formatMoney };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FairShareCore = api;
})(typeof window === 'undefined' ? globalThis : window);
