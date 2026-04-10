import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Oracle middleware URL from system_config
    const { data: configData } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "oracle_middleware")
      .single();

    if (!configData?.value) {
      return new Response(
        JSON.stringify({ error: "Oracle middleware not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = configData.value as { url: string; api_key: string };
    const middlewareUrl = config.url;
    const apiKey = config.api_key;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    let result;

    switch (action) {
      case "health": {
        const resp = await fetch(`${middlewareUrl}/health`);
        result = await resp.json();
        break;
      }

      case "validate-batch": {
        const body = await req.json();
        const resp = await fetch(`${middlewareUrl}/api/validate-batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sync": {
        const body = await req.json().catch(() => ({}));
        const resp = await fetch(`${middlewareUrl}/api/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify(body),
        });
        const syncResult = await resp.json();

        if (syncResult.data && Array.isArray(syncResult.data)) {
          // Upsert into account_status_cache
          const batchSize = 500;
          let upserted = 0;
          for (let i = 0; i < syncResult.data.length; i += batchSize) {
            const batch = syncResult.data.slice(i, i + batchSize).map((r: Record<string, unknown>) => ({
              ...r,
              last_sync_at: new Date().toISOString(),
              sync_hash: "oracle_sync",
              oracle_source_id: r.id_societaire,
            }));

            const { error } = await supabase
              .from("account_status_cache")
              .upsert(batch, { onConflict: "rib", ignoreDuplicates: false });

            if (!error) upserted += batch.length;
          }

          // Log the sync
          await supabase.from("audit_logs").insert({
            action: "oracle_sync",
            description: `Synchronisation Oracle: ${upserted} comptes mis à jour`,
            severity: "info",
            details: {
              source: "oracle_middleware",
              total_fetched: syncResult.data.length,
              total_upserted: upserted,
              sync_timestamp: syncResult.sync_timestamp,
            },
          });

          result = {
            success: true,
            total_fetched: syncResult.data.length,
            total_upserted: upserted,
            sync_timestamp: syncResult.sync_timestamp,
          };
        } else {
          result = syncResult;
        }
        break;
      }

      case "lookup": {
        const rib = url.searchParams.get("rib");
        if (!rib) {
          return new Response(
            JSON.stringify({ error: "rib parameter required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const resp = await fetch(`${middlewareUrl}/api/accounts/${rib}`, {
          headers: { "X-API-Key": apiKey },
        });
        result = await resp.json();
        break;
      }

      case "search": {
        const q = url.searchParams.get("q");
        const type = url.searchParams.get("type") || "nom";
        const resp = await fetch(
          `${middlewareUrl}/api/search?q=${encodeURIComponent(q || "")}&type=${type}`,
          { headers: { "X-API-Key": apiKey } }
        );
        result = await resp.json();
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: health, validate-batch, sync, lookup, search" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Oracle proxy error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
