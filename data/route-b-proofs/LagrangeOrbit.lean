import Mathlib.GroupTheory.GroupAction.CardCommute
import Mathlib.Algebra.BigOperators.Ring.Finset

namespace Proofscape.RouteB

open Finset

/-- Left multiplication by a subgroup is a free action. -/
theorem subgroup_stabilizer_trivial {G : Type*} [Group G] (H : Subgroup G) (g : G) :
    MulAction.stabilizer H g = ⊥ := by
  ext h
  simp only [MulAction.mem_stabilizer_iff, Subgroup.mem_bot]
  constructor
  · intro hh
    apply Subtype.ext
    change (h : G) = 1
    change (h : G) * g = g at hh
    have : (h : G) * g = 1 * g := by simpa only [one_mul] using hh
    exact mul_right_cancel this
  · intro hh
    subst h
    simp

/-- The orbits all have the order of H, so the orbit partition proves Lagrange. -/
theorem lagrange_by_orbits {G : Type*} [Group G] [Fintype G] (H : Subgroup G) [Fintype H] :
    Fintype.card H ∣ Fintype.card G := by
  classical
  letI : Fintype (Quotient (MulAction.orbitRel H G)) := Fintype.ofFinite _
  rw [MulAction.card_eq_sum_card_group_div_card_stabilizer H G]
  apply Finset.dvd_sum
  intro orbit _
  have hs : Nat.card (MulAction.stabilizer H orbit.out) = 1 := by
    rw [subgroup_stabilizer_trivial H orbit.out]
    simp
  have hs' : Fintype.card (MulAction.stabilizer H orbit.out) = 1 := by
    simpa only [Nat.card_eq_fintype_card] using hs
  rw [hs', Nat.div_one]

end Proofscape.RouteB
