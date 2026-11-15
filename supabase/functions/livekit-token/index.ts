/**
 * Supabase Edge Function: `livekit-token`
 *
 * Mints short-lived LiveKit room JWTs using `LIVEKIT_API_KEY` and
 * `LIVEKIT_API_SECRET` stored in Supabase Edge Function Secrets.
 *
 * Deploy with:
 *   supabase secrets set LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...
 *   supabase functions deploy livekit-token --no-verify-jwt
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwtHs256(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

// @ts-expect-error Deno global available in Supabase Edge Functions runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // @ts-expect-error Deno global
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    // @ts-expect-error Deno global
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    // @ts-expect-error Deno global
    const livekitUrl = Deno.env.get('LIVEKIT_URL') ?? Deno.env.get('EXPO_PUBLIC_LIVEKIT_URL');

    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: 'LIVEKIT_API_KEY / LIVEKIT_API_SECRET not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = (await req.json()) as {
      roomCode?: string;
      peerId?: string;
      displayName?: string;
      role?: 'teacher' | 'student';
      canPublish?: boolean;
    };

    const roomCode = String(body.roomCode ?? '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(roomCode) || !body.peerId) {
      return new Response(
        JSON.stringify({ error: 'Valid 6-digit roomCode and peerId are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const isTeacher = body.role === 'teacher';
    const token = await signJwtHs256(
      {
        iss: apiKey,
        sub: body.peerId,
        name: body.displayName ?? (isTeacher ? 'Teacher' : 'Student'),
        nbf: now - 5,
        exp: now + 60 * 60 * 4, // 4-hour class token
        video: {
          roomJoin: true,
          room: `classroom-${roomCode}`,
          canPublish: isTeacher || Boolean(body.canPublish),
          canSubscribe: true,
          canPublishData: true,
        },
      },
      apiSecret,
    );

    return new Response(
      JSON.stringify({ token, url: livekitUrl ?? undefined }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to mint LiveKit token.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
