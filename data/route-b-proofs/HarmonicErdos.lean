/-
The counting argument below is adapted from Mathlib/NumberTheory/SumPrimeReciprocals.lean.
Copyright (c) 2023 Michael Stoll. Released under the Apache License, Version 2.0.
-/
import Mathlib.Analysis.PSeries
import Mathlib.NumberTheory.SmoothNumbers
import Mathlib.Algebra.Order.Group.Indicator

namespace Proofscape.RouteB

open Set Nat
open scoped Finset Topology

/-- Union bound for numbers with a prime factor above the threshold. -/
theorem rough_count_bound (N k : ℕ) :
    #(roughNumbersUpTo N k) ≤
      N * (N.succ.primesBelow \ k.primesBelow).sum (fun p ↦ (1 : ℝ) / p) := by
  simp_rw [Finset.mul_sum, mul_one_div]
  exact (Nat.cast_le.mpr <| roughNumbersUpTo_card_le N k).trans <|
    cast_sum (R := ℝ) .. ▸ Finset.sum_le_sum fun n _ ↦ cast_div_le

/-- Erdős's smooth/rough count gives a lower bound for every prime tail. -/
theorem prime_tail_lower_bound (k : ℕ) :
    1 / 2 ≤ ∑ p ∈ (4 ^ (#k.primesBelow + 1)).succ.primesBelow \ k.primesBelow,
      (1 / p : ℝ) := by
  set m : ℕ := 2 ^ #k.primesBelow
  set N₀ : ℕ := 2 * m ^ 2 with hN₀
  let S : ℝ := ((2 * N₀).succ.primesBelow \ k.primesBelow).sum (fun p ↦ (1 / p : ℝ))
  suffices 1 / 2 ≤ S by
    convert this using 5
    rw [show 4 = 2 ^ 2 by simp, pow_right_comm]
    ring
  suffices 2 * N₀ ≤ m * (2 * N₀).sqrt + 2 * N₀ * S by
    rwa [hN₀, ← mul_assoc, ← pow_two 2, ← mul_pow, sqrt_eq', ← sub_le_iff_le_add',
      cast_mul, cast_mul, cast_pow, cast_two,
      show (2 * (2 * m ^ 2) - m * (2 * m) : ℝ) = 2 * (2 * m ^ 2) * (1 / 2) by ring,
      mul_le_mul_iff_right₀ <| by positivity] at this
  calc (2 * N₀ : ℝ)
    _ = #((2 * N₀).smoothNumbersUpTo k) + #((2 * N₀).roughNumbersUpTo k) := by
        exact mod_cast ((2 * N₀).smoothNumbersUpTo_card_add_roughNumbersUpTo_card k).symm
    _ ≤ m * (2 * N₀).sqrt + #((2 * N₀).roughNumbersUpTo k) := by
        exact mod_cast Nat.add_le_add_right ((2 * N₀).smoothNumbersUpTo_card_le k) _
    _ ≤ m * (2 * N₀).sqrt + 2 * N₀ * S := by grw [rough_count_bound]; norm_cast

/-- If the harmonic series converged, its prime subseries would have small tails,
contradicting the smooth/rough counting bound. -/
theorem harmonic_diverges_by_erdos :
    ¬ Summable (fun n : ℕ => 1 / ((n + 1 : ℕ) : ℝ)) := by
  intro h
  have hall : Summable (fun n : ℕ => (1 : ℝ) / n) := by
    apply (summable_nat_add_iff (f := fun n : ℕ => (1 : ℝ) / n) 1).mp
    simpa using h
  have hp : Summable (indicator {p : ℕ | p.Prime} (fun n : ℕ ↦ (1 : ℝ) / n)) :=
    hall.indicator _
  obtain ⟨k, hk⟩ := hp.nat_tsum_vanishing (Iio_mem_nhds one_half_pos : Iio (1 / 2 : ℝ) ∈ 𝓝 0)
  specialize hk ({p | Nat.Prime p} ∩ {p | k ≤ p}) inter_subset_right
  rw [tsum_subtype, indicator_indicator,
    inter_eq_left.mpr fun n (hn : n ∈ {p | Nat.Prime p} ∩ {p | k ≤ p}) ↦ hn.1, mem_Iio] at hk
  have ht : Summable (indicator ({p | Nat.Prime p} ∩ {p | k ≤ p}) fun n ↦ (1 : ℝ) / n) := by
    convert hp.indicator {n : ℕ | k ≤ n} using 1
    simp only [indicator_indicator, inter_comm]
  refine ((prime_tail_lower_bound k).trans_lt <| LE.le.trans_lt ?_ hk).false
  convert! Summable.sum_le_tsum (primesBelow ((4 ^ (#k.primesBelow + 1)).succ) \ primesBelow k)
      (fun n _ ↦ indicator_nonneg (fun p _ ↦ by positivity) _) ht using 2 with p hp
  obtain ⟨hp₁, hp₂⟩ := mem_ofPred_eq ▸ Finset.mem_sdiff.mp hp
  have hpp := prime_of_mem_primesBelow hp₁
  refine (indicator_of_mem ?_ fun n : ℕ ↦ (1 / n : ℝ)).symm
  exact ⟨hpp, by simpa [primesBelow, hpp] using hp₂⟩

end Proofscape.RouteB
