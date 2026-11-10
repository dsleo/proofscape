import Mathlib.NumberTheory.EulerProduct.Basic
import Mathlib.NumberTheory.SumPrimeReciprocals
import Mathlib.Tactic.Positivity

namespace Proofscape.RouteB

open Set Nat
open scoped Finset Topology

noncomputable def reciprocal : ℕ →* ℝ where
  toFun n := (n : ℝ)⁻¹
  map_one' := by simp
  map_mul' := by intro m n; simp [mul_comm]

lemma reciprocal_prime_lt_one {p : ℕ} (hp : p.Prime) : ‖reciprocal p‖ < 1 := by
  have hpR : (1 : ℝ) < p := by exact_mod_cast hp.one_lt
  have hpos : (0 : ℝ) < p := lt_trans zero_lt_one hpR
  change ‖(p : ℝ)⁻¹‖ < 1
  rw [Real.norm_eq_abs, abs_of_nonneg (le_of_lt (inv_pos.mpr hpos))]
  exact (inv_lt_one₀ hpos).mpr hpR

/-- Euler's product for a finite set of primes bounds its reciprocal sum.
If the harmonic series converges, the product is bounded by its total. -/
theorem prime_sum_le_harmonic_by_euler
    (hH : Summable (fun n : ℕ => (1 : ℝ) / n)) (t : Finset Nat.Primes) :
    (∑ p ∈ t, (1 : ℝ) / (p : ℝ)) ≤ ∑' n : ℕ, (1 : ℝ) / n := by
  classical
  let S : Finset ℕ := t.image (fun p : Nat.Primes => (p : ℕ))
  have hS (p : {p // p ∈ t}) : (p.1 : ℕ) ∈ Nat.factoredNumbers S := by
    apply Nat.mem_factoredNumbers_iff_forall_le.mpr
    refine ⟨p.1.property.ne_zero, ?_⟩
    intro q _ hq hdiv
    have heq : q = (p.1 : ℕ) := (Nat.prime_dvd_prime_iff_eq hq p.1.property).mp hdiv
    rw [heq]
    exact Finset.mem_image.mpr ⟨p.1, p.2, rfl⟩
  let e : {p // p ∈ t} → Nat.factoredNumbers S := fun p => ⟨p.1, hS p⟩
  have he : Function.Injective e := by
    intro a b hab
    apply Subtype.ext
    apply Subtype.ext
    exact congrArg (fun n : Nat.factoredNumbers S => (n : ℕ)) hab
  let T : Finset (Nat.factoredNumbers S) := t.attach.image e
  obtain ⟨_, hprod⟩ :=
    EulerProduct.summable_and_hasSum_factoredNumbers_prod_filter_prime_geometric
      (f := reciprocal) (fun hp => reciprocal_prime_lt_one hp) S
  have heq : (∑ p ∈ t, (1 : ℝ) / (p : ℝ)) = ∑ n ∈ T, reciprocal n := by
    dsimp [T]
    rw [Finset.sum_image (fun _ _ _ _ h => he h)]
    simpa [e, reciprocal, one_div] using (Finset.sum_attach t (fun p : Nat.Primes => (1 : ℝ) / (p : ℝ))).symm
  have hprime : (∑ p ∈ t, (1 : ℝ) / (p : ℝ)) ≤
      ∏ p ∈ S with p.Prime, (1 - reciprocal p)⁻¹ := by
    rw [← hprod.tsum_eq, heq]
    exact hprod.summable.sum_le_tsum T (by
      intro n hn
      change 0 ≤ ((n : ℕ) : ℝ)⁻¹
      positivity)
  have hrecip : Summable reciprocal := by simpa [reciprocal, one_div] using hH
  have hprod_bound : (∏ p ∈ S with p.Prime, (1 - reciprocal p)⁻¹) ≤
      ∑' n : ℕ, (1 : ℝ) / n := by
    rw [← hprod.tsum_eq]
    simpa [reciprocal, one_div] using
      (Summable.tsum_subtype_le (fun n : ℕ => reciprocal n) (Nat.factoredNumbers S)
        (by intro n; change 0 ≤ (n : ℝ)⁻¹; positivity) hrecip)
  exact hprime.trans hprod_bound

/-- Harmonic divergence via Euler's product and the independent divergence
of the prime reciprocal series (proved by Erdős counting in Mathlib). -/
theorem harmonic_diverges_by_euler :
    ¬ Summable (fun n : ℕ => (1 : ℝ) / ((n + 1 : ℕ) : ℝ)) := by
  intro h
  have hH : Summable (fun n : ℕ => (1 : ℝ) / n) := by
    apply (summable_nat_add_iff (f := fun n : ℕ => (1 : ℝ) / n) 1).mp
    simpa using h
  have hp : Summable (fun p : Nat.Primes => (1 : ℝ) / (p : ℝ)) := by
    apply summable_of_sum_le (c := ∑' n : ℕ, (1 : ℝ) / n)
    · intro p; positivity
    · intro t; exact prime_sum_le_harmonic_by_euler hH t
  exact Nat.Primes.not_summable_one_div hp

end Proofscape.RouteB
