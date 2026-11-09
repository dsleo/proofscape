import Mathlib.Algebra.BigOperators.Ring.Finset
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.NormNum

namespace Proofscape.RouteB

open Finset

/-- The sum of the first n integers, doubled, proved by induction. -/
theorem sum_first_n_doubled (n : ℕ) :
    2 * (∑ i ∈ range (n + 1), i) = n * (n + 1) := by
  induction n with
  | zero => simp
  | succ n ih =>
      rw [sum_range_succ]
      nlinarith

/-- The natural-number division version of the formula. -/
theorem sum_first_n (n : ℕ) :
    (∑ i ∈ range (n + 1), i) = n * (n + 1) / 2 := by
  have h := sum_first_n_doubled n
  omega

end Proofscape.RouteB
