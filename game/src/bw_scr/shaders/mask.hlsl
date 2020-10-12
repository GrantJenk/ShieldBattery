struct VS_OUTPUT
{
    float4 pos : SV_POSITION;
    float2 texCoord : TEXCOORD0;
};

SamplerState maskSampler : register(s0);
Texture2D <float4> mask: register(t0);

struct PS_OUTPUT
{
    float4 frag_color : SV_Target0;
};

PS_OUTPUT main(VS_OUTPUT v)
{
    PS_OUTPUT o;
    float maskValue = mask.Sample(maskSampler, v.texCoord).x;
    o.frag_color = float4(0.0, 0.0, 0.0, maskValue * 0.90);
    return o;
}

