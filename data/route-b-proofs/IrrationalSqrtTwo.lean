import Mathlib.NumberTheory.Real.Irrational
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.NormNum
import Mathlib.Tactic.FieldSimp

namespace Proofscape.RouteB

/-- A hypothetical solution descends from (a,b) to (b-a,2a-b). -/
theorem sqrt_two_descent (a : ℕ) :
    ∀ b : ℕ, 0 < a → b ^ 2 = 2 * a ^ 2 → False := by
  induction a using Nat.strong_induction_on with
  | ind a ih =>
    intro b ha h
    have hab : a < b := by nlinarith
    have hba : b < 2 * a := by nlinarith
    have hsub₁ : b - a + a = b := Nat.sub_add_cancel (by omega)
    have hsub₂ : 2 * a - b + b = 2 * a := Nat.sub_add_cancel (by omega)
    have hnew : (2 * a - b) ^ 2 = 2 * (b - a) ^ 2 := by nlinarith
    exact ih (b - a) (by omega) (2 * a - b) (by omega) hnew

/-- Irrationality of sqrt 2 by the geometric infinite descent. -/
theorem irrational_sqrt_two_by_descent : Irrational (Real.sqrt 2) := by
  rw [irrational_iff_ne_rational]
  intro a b hb h
  have hbR : (b : ℝ) ≠ 0 := by exact_mod_cast hb
  have hsqrt : (Real.sqrt 2) ^ 2 = (2 : ℝ) := Real.sq_sqrt (by norm_num)
  have hmul : Real.sqrt 2 * b = a := by
    rw [h]
    field_simp
  have heqR : (a : ℝ) ^ 2 = 2 * (b : ℝ) ^ 2 := by
    calc
      (a : ℝ) ^ 2 = (Real.sqrt 2 * b) ^ 2 := by rw [hmul]
      _ = 2 * (b : ℝ) ^ 2 := by rw [mul_pow, hsqrt]
  have heqZ : a ^ 2 = 2 * b ^ 2 := by exact_mod_cast heqR
  have heqN : a.natAbs ^ 2 = 2 * b.natAbs ^ 2 := by
    simpa [Int.natAbs_mul, Int.natAbs_pow] using congrArg Int.natAbs heqZ
  exact sqrt_two_descent b.natAbs a.natAbs (Int.natAbs_pos.mpr hb) heqN

end Proofscape.RouteB
