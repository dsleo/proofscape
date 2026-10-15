import { memo } from 'react'
import type { Theme } from './worldTheme'
import type { World } from './worldLayout'

/** The static picture: sea texture and every island with its terrain. Redrawn only when the theme or the tree detail changes. */
function LandLayer({ world, theme, close }: { world: World; theme: Theme; close: boolean }) {
  return (
  <g pointerEvents="none">
      <path className="world-texture" d={world.wisps} fill={theme.wisp} fillOpacity="0.8" />
                  {world.islands.map((i) => {
        const c = theme.hue(i.family)
        return <g key={i.family}>
          {theme.ripples ? <>
            <path className="world-texture" d={i.halo} fill="none" stroke={c.dark} strokeOpacity="0.35" strokeWidth="1.1" strokeDasharray="9 9" />
            <path d={i.near} fill="none" stroke={c.dark} strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="14 6" />
            <path className="world-texture" d={i.path} fill="url(#w-hatch)" opacity="0.5" transform="translate(5 6)" />
          </> : <>
            <path d={i.halo} fill={c.halo} fillOpacity="0.75" />
            <path d={i.path} fill={c.dark} fillOpacity={theme.shade} transform="translate(0 7)" />
          </>}
          <path d={i.path} fill={c.land} />
          <path className="world-minor" d={i.land.minor} fill="none" stroke={c.light} strokeWidth="0.9" strokeLinecap="round" />
          <path className="world-major" d={i.land.major} fill="none" stroke={c.dark} strokeOpacity="0.45" strokeWidth="1.1" strokeLinecap="round" />
          <path d={i.land.lakes} fill={theme.water} stroke={c.dark} strokeOpacity="0.7" strokeWidth="1" />
          {i.land.rivers.map((r, n) => <path key={n} className="world-river" d={r.water} fill="none" stroke={theme.water} strokeWidth="4" strokeLinecap="round" />)}
          <path d={i.land.fields} fill="none" stroke={c.dark} strokeOpacity="0.65" strokeWidth="0.8" strokeLinejoin="round" />
          <path d={i.land.squares} fill="none" stroke={c.dark} strokeOpacity="0.7" strokeWidth="0.9" strokeLinejoin="round" />
          <path d={i.land.dunes} fill="none" stroke={c.dark} strokeOpacity="0.6" strokeWidth="0.9" strokeLinecap="round" />
          <path d={i.land.spirals} fill="none" stroke={c.dark} strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round" />
          {close
            ? i.land.trees.map((t, n) => <path key={n} d={t.d} fill={theme.tree(c)} stroke={c.dark} strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />)
            : <path d={i.treeD} fill={theme.tree(c)} stroke={c.dark} strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />}
          <path className="world-texture" d={i.treeH} fill="none" stroke={theme.hatchInk(c)} strokeOpacity="0.7" strokeWidth="0.8" strokeLinecap="round" />
          <path d={i.land.mountains} fill={c.peak} stroke={c.dark} strokeWidth="1.3" strokeLinejoin="round" />
          <path d={i.land.hatch} fill="none" stroke={c.dark} strokeOpacity="0.7" strokeWidth="0.9" strokeLinecap="round" />
          <path d={i.land.ink} fill={theme.paper} fillOpacity="0.92" stroke={c.dark} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={i.path} fill="none" stroke={theme.coast ? c.dark : c.light} strokeWidth={theme.coast || 2} strokeLinejoin="round" />
        </g>
      })}
    </g>
  )
}

export default memo(LandLayer)
