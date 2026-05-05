import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

// HTML page that reads hash fragment tokens client-side
// (hash fragments are never sent to the server)
function hashCallbackHtml() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DiningView</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"><\/script>
<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.card{background:#fff;border-radius:1rem;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:2rem;max-width:22rem;width:100%;text-align:center}h1{font-size:1.5rem;font-weight:700;color:#0f172a;margin-bottom:.5rem}.msg{font-size:.875rem;color:#64748b}.err{font-size:.875rem;color:#ef4444}</style>
</head><body><div class="card"><h1>DiningView</h1><p id="s" class="msg">驗證中，請稍候...</p></div>
<script>
(async function(){
  var el=document.getElementById('s');
  try{
    var h=window.location.hash.substring(1);
    var p=new URLSearchParams(h);
    var at=p.get('access_token'), rt=p.get('refresh_token'), ty=p.get('type');
    var q=new URLSearchParams(window.location.search);
    var qt=q.get('type');
    var ct=ty||qt;
    if(!at||!rt){el.className='err';el.textContent='驗證失敗，正在返回登入頁...';setTimeout(function(){window.location.href='/login'},2000);return}
    var sb=window.supabase.createClient('${supabaseUrl}','${supabaseKey}');
    var r=await sb.auth.setSession({access_token:at,refresh_token:rt});
    if(r.error){el.className='err';el.textContent='驗證失敗：'+r.error.message;setTimeout(function(){window.location.href='/login'},3000);return}
    window.location.href=(ct==='invite'||ct==='recovery')?'/set-password':'/dashboard';
  }catch(e){el.className='err';el.textContent='發生錯誤：'+e.message}
})();
<\/script></body></html>`
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  // If no code param, serve client-side HTML to handle hash fragment tokens
  if (!code) {
    return new NextResponse(hashCallbackHtml(), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (!error) {
    if (type === 'invite' || type === 'recovery') {
      return NextResponse.redirect(`${origin}/set-password`)
    }
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
