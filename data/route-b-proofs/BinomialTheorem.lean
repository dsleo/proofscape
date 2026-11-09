import Mathlib.Algebra.BigOperators.Ring.Finset
import Mathlib.Algebra.BigOperators.Group.Finset.Powerset
import Mathlib.Algebra.Ring.Subsemiring.Basic

namespace Proofscape.RouteB

open Finset
open scoped IsMulCommutative

/-- Expand the choices of x and y as subsets of an n-element set. -/
theorem binomial_expand_subsets {R : Type*} [CommSemiring R] (x y : R) (n : ℕ) :
    (x + y) ^ n =
      ∑ s ∈ (univ : Finset (Fin n)).powerset, x ^ s.card * y ^ (n - s.card) := by
  simpa using (Finset.sum_pow_mul_eq_add_pow x y (univ : Finset (Fin n))).symm

/-- Group the subsets by cardinality; there are choose n k of size k. -/
theorem binomial_by_subsets {R : Type*} [CommSemiring R] (x y : R) (n : ℕ) :
    (x + y) ^ n = ∑ k ∈ range (n + 1), (n.choose k) • (x ^ k * y ^ (n - k)) := by
  rw [binomial_expand_subsets]
  rw [Finset.sum_powerset]
  simp only [Finset.card_univ, Fintype.card_fin]
  apply Finset.sum_congr rfl
  intro k hk
  simpa using (Finset.sum_powersetCard k (univ : Finset (Fin n))
    (fun j => x ^ j * y ^ (n - j)))

/-- Two commuting elements generate a commutative subsemiring; apply the
subset-counting proof there and map the result back to the original semiring. -/
theorem binomial_by_subsets_of_commute {R : Type*} [Semiring R] (x y : R)
    (hxy : Commute x y) (n : ℕ) :
    (x + y) ^ n = ∑ k ∈ range (n + 1), (n.choose k) • (x ^ k * y ^ (n - k)) := by
  classical
  let S := Subsemiring.closure ({x, y} : Set R)
  have hcomm : ({x, y} : Set R).Pairwise Commute := by
    intro a ha b hb hab
    simp only [Set.mem_insert_iff, Set.mem_singleton_iff] at ha hb
    rcases ha with rfl | rfl <;> rcases hb with rfl | rfl
    · exact Commute.refl _
    · exact hxy
    · exact hxy.symm
    · exact Commute.refl _
  letI : IsMulCommutative S := Subsemiring.isMulCommutative_closure hcomm
  let xx : S := ⟨x, Subsemiring.subset_closure (by simp)⟩
  let yy : S := ⟨y, Subsemiring.subset_closure (by simp)⟩
  have h := binomial_by_subsets xx yy n
  have h' := congrArg (fun z : S => (z : R)) h
  simpa using h'

end Proofscape.RouteB
