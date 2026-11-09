import Mathlib.NumberTheory.LegendreSymbol.GaussEisensteinLemmas

namespace Proofscape.RouteB

open Finset

/-- Eisenstein's form of Gauss's lemma and the lattice-point count prove
quadratic reciprocity for distinct odd primes. -/
theorem quadratic_reciprocity_by_lattice {p q : ℕ} [Fact p.Prime] [Fact q.Prime]
    (hp : p ≠ 2) (hq : q ≠ 2) (hpq : p ≠ q) :
    legendreSym p q * legendreSym q p = (-1) ^ (p / 2 * (q / 2)) := by
  have hpOdd : p % 2 = 1 := (Nat.Prime.mod_two_eq_one_iff_ne_two Fact.out).mpr hp
  have hqOdd : q % 2 = 1 := (Nat.Prime.mod_two_eq_one_iff_ne_two Fact.out).mpr hq
  have hqp : (q : ZMod p) ≠ 0 := ZMod.prime_ne_zero p q hpq
  have hpq' : (p : ZMod q) ≠ 0 := ZMod.prime_ne_zero q p hpq.symm
  have h₁ := ZMod.eisenstein_lemma hp hqOdd hqp
  have h₂ := ZMod.eisenstein_lemma hq hpOdd hpq'
  have hcount := ZMod.sum_mul_div_add_sum_mul_div_eq_mul p q hqp
  rw [h₁, h₂, ← pow_add, hcount]

end Proofscape.RouteB
