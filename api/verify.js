/* ====================================================================
   FAST TRACK D.A.L.P.S — Service d'activation (fonction Vercel)
   --------------------------------------------------------------------
   Vérifie une Clé d'activation FAST TRACK auprès du fournisseur de
   licences (invisible pour l'utilisateur). Zéro base de données.
   Variables d'environnement Vercel requises :
     GUMROAD_PRODUCT_ID   (obligatoire — réglages du produit Gumroad)
     ACTIVATION_MAX_USES  (optionnel — défaut 5 activations par clé)
   ==================================================================== */
module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, reason: 'method' });
    }
    const productId = process.env.GUMROAD_PRODUCT_ID;
    if (!productId) {
        return res.status(200).json({ ok: false, reason: 'config' });
    }
    const key = ((req.body && req.body.key) || '').toString().trim();
    if (key.length < 8) {
        return res.status(200).json({ ok: false, reason: 'invalid' });
    }
    const maxUses = parseInt(process.env.ACTIVATION_MAX_USES || '5', 10);
    try {
        const body = new URLSearchParams();
        body.append('product_id', productId);
        body.append('license_key', key);
        body.append('increment_uses_count', 'true');
        const r = await fetch('https://api.gumroad.com/v2/licenses/verify', { method: 'POST', body });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.success) {
            return res.status(200).json({ ok: false, reason: 'invalid' });
        }
        const p = data.purchase || {};
        if (p.refunded || p.chargebacked || p.disputed) {
            return res.status(200).json({ ok: false, reason: 'revoked' });
        }
        if (typeof data.uses === 'number' && data.uses > maxUses && !p.test) {
            return res.status(200).json({ ok: false, reason: 'max_uses' });
        }
        return res.status(200).json({ ok: true });
    } catch (e) {
        return res.status(200).json({ ok: false, reason: 'network' });
    }
};
