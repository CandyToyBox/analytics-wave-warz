export function generateBattleFrameHtml(battle: any, baseUrl: string): string {
  if (!battle) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="https://wavewarz.com/logo.png" />
          <meta property="fc:frame:button:1" content="Check Back Later" />
          <title>No Active Battles</title>
        </head>
        <body>No active battles found.</body>
      </html>
    `;
  }

  // Use the battle image or a fallback
  const imageUrl = battle.image_url || 'https://wavewarz.com/default-battle.png';
  
  // Stats
  const tvlA = battle.artist1_pool || 0;
  const tvlB = battle.artist2_pool || 0;
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="og:title" content="${battle.artist1_name} vs ${battle.artist2_name}" />
        <meta property="og:image" content="${imageUrl}" />
        
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${imageUrl}" />
        <meta property="fc:frame:image:aspect_ratio" content="1:1" />
        
        <!-- Button 1: Refresh Stats -->
        <meta property="fc:frame:button:1" content="🔄 Refresh Stats (A: ${tvlA} | B: ${tvlB})" />
        <meta property="fc:frame:button:1:action" content="post" />
        
        <!-- Button 2: Link to App -->
        <meta property="fc:frame:button:2" content="🚀 Vote / Trade on App" />
        <meta property="fc:frame:button:2:action" content="link" />
        <meta property="fc:frame:button:2:target" content="https://wavewarz-analytics.vercel.app" />
        
        <title>WaveWarz: ${battle.artist1_name} vs ${battle.artist2_name}</title>
      </head>
      <body>
        <h1>WaveWarz Battle</h1>
        <p>${battle.artist1_name} vs ${battle.artist2_name}</p>
        <p>TVL A: ${tvlA} SOL</p>
        <p>TVL B: ${tvlB} SOL</p>
        <img src="${imageUrl}" />
      </body>
    </html>
  `;
}