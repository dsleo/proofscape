"""Chronology rules for milestone records.
1. Nothing that builds on an idea can precede its first public statement: a naming, consolidation, institution, first_application,
   key_development or recognition milestone dated before the earliest first_statement is reclassified as a precursor (with a note).
   Typical case: a field-level textbook or name attached to a later, narrower result.
2. Strict derived dates (conceptual, methodological, institutional) use only the roles in the schema, after rule 1.
3. 'Shown' dates relax that for display, and say so: first applied falls back to the earliest later key development; if there is no
   first_statement the earliest dated milestone is shown as the idea date; every fallback carries a basis label."""
LATER = ('naming', 'consolidation', 'institution', 'first_application', 'key_development', 'recognition')
STRICT = (('conceptual', ('first_statement',)), ('methodological', ('first_application',)), ('institutional', ('naming', 'consolidation', 'institution')))

def normalize(e):
    """Mutates milestones in place; returns number reclassified."""
    ms = e.get('milestones') or []
    fs = [m['year'] for m in ms if m.get('role') == 'first_statement' and m.get('year') is not None]
    n = 0
    if fs:
        t = min(fs)
        for m in ms:
            if m.get('role') in LATER and m.get('year') is not None and m['year'] < t:
                m['note'] = ((m.get('note') or '') + f" Reclassified from {m['role']} to precursor: it predates this event's first statement ({t}) and belongs to the wider field.").strip()
                m['role'] = 'precursor'; n += 1
    return n

def strict(ms):
    out = {}
    for k, roles in STRICT:
        ys = [m['year'] for m in ms if m.get('role') in roles and m.get('year') is not None]
        out[k] = min(ys) if ys else None
    return out

def shown(ms):
    """-> {key: {'y': year or None, 'basis': str}} for display."""
    s = strict(ms); out = {}
    dated = [m for m in ms if m.get('year') is not None]
    fsy = s['conceptual']
    if fsy is not None: out['conceptual'] = {'y': fsy, 'basis': 'first statement'}
    elif dated:
        m = min(dated, key=lambda m: m['year']); out['conceptual'] = {'y': m['year'], 'basis': f"earliest milestone ({m['role'].replace('_', ' ')}); no first statement found"}
    else: out['conceptual'] = {'y': None, 'basis': 'no dated milestone'}
    if s['methodological'] is not None: out['methodological'] = {'y': s['methodological'], 'basis': 'first application'}
    else:
        c = [m for m in dated if m['role'] == 'key_development' and (fsy is None or m['year'] >= fsy)]
        if c: out['methodological'] = {'y': min(m['year'] for m in c), 'basis': 'earliest key development; no first application found'}
        else: out['methodological'] = {'y': None, 'basis': 'no first application or key development'}
    if s['institutional'] is not None: out['institutional'] = {'y': s['institutional'], 'basis': 'naming, textbook or institution'}
    else: out['institutional'] = {'y': None, 'basis': 'no naming, textbook or institution found'}
    return out


LATE = ('first_application', 'key_development', 'naming', 'consolidation', 'institution')

def took_hold(ms, idea_year):
    """Earliest later milestone (application, development, naming, textbook, institution) at or after the idea date.
    Returns {'y', 'role', 'label', 'same'}; 'same' is True when it is under 5 years after the idea (shown as 'same period')."""
    c = [m for m in ms if m.get('role') in LATE and m.get('year') is not None and (idea_year is None or m['year'] >= idea_year)]
    if not c: return {'y': None, 'role': None, 'label': None, 'same': False}
    m = min(c, key=lambda m: m['year'])
    return {'y': m['year'], 'role': m['role'], 'label': m.get('label'), 'same': idea_year is not None and m['year'] - idea_year < 5}
