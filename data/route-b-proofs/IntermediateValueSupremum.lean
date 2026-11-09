import Mathlib.Topology.Instances.Real.Lemmas
import Mathlib.Algebra.Order.Archimedean.Real.Basic
import Mathlib.Tactic.Linarith

namespace Proofscape.RouteB

open Set

/-- The intermediate value theorem via the supremum of the strict sublevel set. -/
theorem intermediate_value_by_supremum {a b y : ℝ} {f : ℝ → ℝ}
    (hab : a ≤ b) (hf : ContinuousOn f (Icc a b))
    (hay : f a ≤ y) (hyb : y ≤ f b) :
    ∃ c ∈ Icc a b, f c = y := by
  by_cases ha : f a = y
  · exact ⟨a, ⟨le_rfl, hab⟩, ha⟩
  by_cases hb : f b = y
  · exact ⟨b, ⟨hab, le_rfl⟩, hb⟩
  have hfa : f a < y := lt_of_le_of_ne hay ha
  have hfb : y < f b := lt_of_le_of_ne hyb (Ne.symm hb)
  let S : Set ℝ := {x | x ∈ Icc a b ∧ f x < y}
  have hne : S.Nonempty := ⟨a, ⟨⟨le_rfl, hab⟩, hfa⟩⟩
  have hbounded : BddAbove S := ⟨b, fun _ hx => hx.1.2⟩
  let c := sSup S
  have hca : a ≤ c := le_csSup hbounded ⟨⟨le_rfl, hab⟩, hfa⟩
  have hcb : c ≤ b := csSup_le hne (fun _ hx => hx.1.2)
  have hc : c ∈ Icc a b := ⟨hca, hcb⟩
  have hnot_lt : ¬ f c < y := by
    intro hcy
    have hcb' : c < b := by
      by_contra h
      have : c = b := le_antisymm hcb (le_of_not_gt h)
      rw [this] at hcy
      linarith
    obtain ⟨δ, hδ, hcont⟩ := (Metric.continuousOn_iff.mp hf) c hc (y - f c) (by linarith)
    let z := min b (c + δ / 2)
    have hcz : c < z := lt_min hcb' (by linarith)
    have hzb : z ≤ b := min_le_left _ _
    have hzbound : z ≤ c + δ / 2 := min_le_right _ _
    have hz : z ∈ Icc a b := ⟨le_trans hca (le_of_lt hcz), hzb⟩
    have hdist : dist z c < δ := by
      rw [Real.dist_eq, abs_of_nonneg (by linarith)]
      linarith
    have hdiff := hcont z hz hdist
    rw [Real.dist_eq, abs_lt] at hdiff
    have hzS : z ∈ S := ⟨hz, by linarith [hdiff.2]⟩
    have hzc : z ≤ c := le_csSup hbounded hzS
    linarith
  have hnot_gt : ¬ y < f c := by
    intro hyc
    have hac : a < c := by
      by_contra h
      have : c = a := le_antisymm (le_of_not_gt h) hca
      rw [this] at hyc
      linarith
    obtain ⟨δ, hδ, hcont⟩ := (Metric.continuousOn_iff.mp hf) c hc (f c - y) (by linarith)
    let z := max a (c - δ / 2)
    have hza : a ≤ z := le_max_left _ _
    have hzc : z < c := max_lt hac (by linarith)
    have hzbound : c - δ / 2 ≤ z := le_max_right _ _
    have hupper : ∀ t ∈ S, t ≤ z := by
      intro t ht
      by_contra htz
      have htz' : z < t := lt_of_not_ge htz
      have htc : t ≤ c := le_csSup hbounded ht
      have hdist : dist t c < δ := by
        rw [Real.dist_eq, abs_of_nonpos (by linarith)]
        linarith
      have hdiff := hcont t ht.1 hdist
      rw [Real.dist_eq, abs_lt] at hdiff
      linarith [hdiff.1, ht.2]
    have hcz : c ≤ z := csSup_le hne hupper
    linarith
  exact ⟨c, hc, le_antisymm (le_of_not_gt hnot_gt) (le_of_not_gt hnot_lt)⟩

end Proofscape.RouteB
