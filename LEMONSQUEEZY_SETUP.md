# LemonSqueezy billing setup (ExplainIt)

1. **Store**  
   Use store **309460** (or create one and set `LEMONSQUEEZY_STORE_ID` in `.env`).

2. **Products**  
   In LemonSqueezy dashboard, create **2 products**:
   - **Pro** — $19/month subscription (50 pipelines).
   - **Team** — $49/month subscription (unlimited pipelines).

3. **Variant IDs**  
   For each product, open the variant and copy its **Variant ID**. Set in `.env`:
   - `LEMONSQUEEZY_PRO_VARIANT_ID=<pro variant id>`
   - `LEMONSQUEEZY_TEAM_VARIANT_ID=<team variant id>`

4. **Webhook**  
   - Settings → Webhooks → Add endpoint: `https://your-domain.com/api/billing/webhook`
   - Events: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`
   - Copy the **Signing secret** to `LEMONSQUEEZY_WEBHOOK_SECRET` in `.env`.

5. **API key**  
   Settings → API → Create key → set `LEMONSQUEEZY_API_KEY` in `.env`.

See `.env.example` for all required variables.
