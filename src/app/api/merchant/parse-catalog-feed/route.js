import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const { url } = await req.json();
        if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Tagdeer-Bot/1.0' },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            return NextResponse.json({ error: `Failed to fetch feed: ${response.status}` }, { status: 502 });
        }

        const text = await response.text();
        const contentType = response.headers.get('content-type') || '';

        let products = [];

        if (contentType.includes('xml') || text.trim().startsWith('<?xml') || text.trim().startsWith('<')) {
            // XML parsing (Google Merchant Center / RSS / Atom feeds)
            const itemRegex = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/gi;
            let match;
            while ((match = itemRegex.exec(text)) !== null) {
                const block = match[1] || match[2];
                const get = (tag) => {
                    const m = block.match(new RegExp(`<(?:g:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:g:)?${tag}>`, 'i'));
                    return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
                };
                products.push({
                    name: get('title'),
                    description: get('description').replace(/<[^>]+>/g, '').slice(0, 500),
                    price: parseFloat(get('price') || get('sale_price') || '0'),
                    category: get('product_type') || get('category') || 'General',
                    image_url: get('image_link') || get('image'),
                    sku: get('id') || get('sku') || get('mpn'),
                });
            }
        } else if (contentType.includes('json') || text.trim().startsWith('[') || text.trim().startsWith('{')) {
            // JSON parsing (Shopify, WooCommerce, custom APIs)
            const json = JSON.parse(text);
            const items = Array.isArray(json) ? json : (json.products || json.items || json.data || []);
            products = items.map(item => ({
                name: item.name || item.title || '',
                description: (item.description || item.body_html || '').replace(/<[^>]+>/g, '').slice(0, 500),
                price: parseFloat(item.price || item.variants?.[0]?.price || '0'),
                category: item.category || item.product_type || 'General',
                image_url: item.image_url || item.image?.src || item.images?.[0]?.src || '',
                sku: item.sku || item.id?.toString() || '',
            }));
        } else {
            // CSV/TSV fallback
            const delimiter = text.includes('\t') ? '\t' : ',';
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) {
                return NextResponse.json({ error: 'Feed appears empty or unrecognized format' }, { status: 400 });
            }
            const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
            products = lines.slice(1).map(line => {
                const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
                const obj = {};
                headers.forEach((h, i) => { obj[h] = values[i] || ''; });
                return {
                    name: obj.name || obj.title || obj.product_name || '',
                    description: (obj.description || obj.desc || '').slice(0, 500),
                    price: parseFloat(obj.price || obj.amount || '0'),
                    category: obj.category || obj.type || 'General',
                    image_url: obj.image_url || obj.image || obj.photo || '',
                    sku: obj.sku || obj.id || '',
                };
            });
        }

        products = products.filter(p => p.name);

        return NextResponse.json({
            products: products.slice(0, 200), // Cap at 200 products per import
            count: products.length,
            format: contentType.includes('xml') ? 'xml' : contentType.includes('json') ? 'json' : 'csv',
        });
    } catch (err) {
        console.error('Feed parse error:', err);
        return NextResponse.json({ error: err.message || 'Failed to parse feed' }, { status: 500 });
    }
}
