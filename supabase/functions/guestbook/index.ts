import { withSupabase } from 'npm:@supabase/server@1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function hashIp(ip: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip))
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function verifyTurnstile(token: string, ip: string, expectedHost: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) throw new Error('Turnstile is not configured')
  const form = new FormData()
  form.set('secret', secret)
  form.set('response', token)
  if (ip) form.set('remoteip', ip)
  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
  if (!result.ok) return false
  const data = await result.json()
  return data.success === true && data.hostname === expectedHost
}

export default {
  fetch: withSupabase({ auth: 'publishable' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const origin = req.headers.get('origin') ?? ''
    const allowedOrigins = (Deno.env.get('GUESTBOOK_ALLOWED_ORIGINS') ?? '').split(',').map(value => value.trim()).filter(Boolean)
    if (!origin || !allowedOrigins.includes(origin)) return json({ error: 'Origin not allowed' }, 403)

    if (req.method === 'GET') {
      const { data, error } = await ctx.supabaseAdmin
        .from('guestbook_messages')
        .select('id,nickname,message,created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) return json({ error: 'Could not load messages' }, 500)
      return json(data ?? [])
    }

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    try {
      const body = await req.json()
      const nickname = typeof body.nickname === 'string' ? body.nickname.trim().slice(0, 40) : ''
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : ''
      if (typeof body.website === 'string' && body.website.trim()) return json({ ok: true })
      if (!message || message.length > 600 || !token) return json({ error: 'Invalid message' }, 400)

      const originHost = new URL(origin).hostname
      const forwarded = req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ?? ''
      const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? forwarded
      if (!await verifyTurnstile(token, ip, originHost)) return json({ error: 'Security check failed' }, 400)

      const salt = Deno.env.get('GUESTBOOK_RATE_SALT')
      if (!salt) return json({ error: 'Guestbook is not configured' }, 503)
      const ipHash = await hashIp(ip || crypto.randomUUID(), salt)
      const { data: allowed, error: limitError } = await ctx.supabaseAdmin.rpc('guestbook_take_rate_limit', { p_ip_hash: ipHash })
      if (limitError) return json({ error: 'Could not verify posting limit' }, 500)
      if (!allowed) return json({ error: 'Please wait before posting again' }, 429)

      const { error } = await ctx.supabaseAdmin.from('guestbook_messages').insert({
        nickname: nickname || '访客',
        message,
        status: 'pending',
      })
      if (error) return json({ error: 'Could not save message' }, 500)
      return json({ ok: true, status: 'pending' }, 201)
    } catch {
      return json({ error: 'Invalid request' }, 400)
    }
  }),
}
