import sys,re
from bs4 import BeautifulSoup
def txt(el): return re.sub(r'\s+',' ',el.get_text('')).strip()
def conv(path):
    s=BeautifulSoup(open(path,encoding='utf-8',errors='replace').read(),'html.parser')
    for sc in s.find_all('script'):
        if 'math/tex' in (sc.get('type') or ''):
            d='$$' if 'mode=display' in (sc.get('type') or '') else '$'
            sc.replace_with(d+sc.get_text()+d)
    for t in s(['script','style','annotation-xml','annotation','noscript']): t.decompose()
    for m in s.find_all('math'):
        for _ in range(30):
            ch=False
            for tag in m.find_all(['mfrac','msup','msub','msqrt','msubsup','mover','munder']):
                if tag.find(['mfrac','msup','msub','msqrt','msubsup','mover','munder']): continue
                c=[txt(x) for x in tag.find_all(recursive=False)]
                n=tag.name
                if n=='mfrac' and len(c)==2: r=f'({c[0]})/({c[1]})'
                elif n=='msup' and len(c)==2: r=f'{c[0]}^({c[1]})' if len(c[1])>1 else f'{c[0]}^{c[1]}'
                elif n=='msub' and len(c)==2: r=f'{c[0]}_({c[1]})' if len(c[1])>1 else f'{c[0]}_{c[1]}'
                elif n=='msqrt': r='√('+''.join(c)+')'
                elif n=='msubsup' and len(c)==3: r=f'{c[0]}_({c[1]})^({c[2]})'
                else: r=''.join(c)
                tag.replace_with(r); ch=True
            if not ch: break
    for b in s.find_all(['br']): b.replace_with('\n')
    for b in s.find_all(['p','div','h1','h2','h3','h4','li','tr','pre']): b.append('\n')
    t=s.get_text('')
    t=re.sub(r'[ \t ]+',' ',t); t=re.sub(r'\n\s*\n+','\n\n',t)
    return t
if __name__=='__main__': print(conv(sys.argv[1]))
