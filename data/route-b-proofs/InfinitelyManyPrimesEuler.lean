import Mathlib.NumberTheory.EulerProduct.Basic
import Mathlib.Analysis.PSeries
import Mathlib.Tactic.Positivity
import Mathlib.Tactic.NormNum

namespace Proofscape.RouteB

open Set Nat
open scoped BigOperators

/-- Reciprocal as a completely multiplicative function on natural numbers. -/
noncomputable def reciprocal : ℕ →* ℝ where
  toFun n := (n : ℝ)⁻¹
  map_one' := by simp
  map_mul' := by intro m n; simp [mul_comm]

/-- Euler's proof: a finite set of all primes would make the harmonic series
converge, since its terms form the geometric Euler product over that set. -/
theorem infinitely_many_primes_euler : {p : ℕ | p.Prime}.Infinite := by
  intro hfinite
  classical
  let S := hfinite.toFinset
  have hall : ∀ p : ℕ, p.Prime → p ∈ S := by
    intro p hp
    exact hfinite.mem_toFinset.mpr hp
  have hsmall : ∀ {p : ℕ}, p.Prime → ‖reciprocal p‖ < 1 := by
    intro p hp
    have hpR : (1 : ℝ) < p := by exact_mod_cast hp.one_lt
    have hpos : (0 : ℝ) < p := lt_trans zero_lt_one hpR
    change ‖(p : ℝ)⁻¹‖ < 1
    rw [Real.norm_eq_abs, abs_of_nonneg (le_of_lt (inv_pos.mpr hpos))]
    exact (inv_lt_one₀ hpos).mpr hpR
  obtain ⟨hsum, hproduct⟩ :=
    EulerProduct.summable_and_hasSum_factoredNumbers_prod_filter_prime_geometric hsmall S
  let e : ℕ → Nat.factoredNumbers S := fun n =>
    ⟨n + 1, Nat.mem_factoredNumbers_iff_forall_le.mpr
      ⟨Nat.succ_ne_zero n, fun p _ hp _ => hall p hp⟩⟩
  have hinj : Function.Injective e := by
    intro i j hij
    have h : i + 1 = j + 1 := congrArg Subtype.val hij
    omega
  have hs := hsum.comp_injective hinj
  have heval (n : ℕ) : ‖reciprocal (e n)‖ = (1 : ℝ) / (n + 1) := by
    change ‖(((n + 1 : ℕ) : ℝ)⁻¹)‖ = (1 : ℝ) / (n + 1)
    rw [Real.norm_eq_abs, abs_of_nonneg (by positivity), one_div]
    simp
  change Summable (fun n : ℕ => ‖reciprocal (e n)‖) at hs
  simp only [heval] at hs
  exact Real.not_summable_one_div_natCast ((summable_nat_add_iff 1).mp (by simpa using hs))

end Proofscape.RouteB
