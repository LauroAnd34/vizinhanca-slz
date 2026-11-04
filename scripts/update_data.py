"""Atualiza data/pois.json e data/bairros.json com dados atuais do OpenStreetMap (Overpass API).

Roda no GitHub Actions toda semana (ver .github/workflows/update-data.yml) ou manualmente:
    python scripts/update_data.py
A classificação (escola municipal/estadual/particular etc.) é feita no navegador, em app.js.
"""
import json, math, sys, time, urllib.parse, urllib.request, datetime, os

BBOX = "-2.72,-44.42,-2.44,-44.15"  # sul, oeste, norte, leste (Ilha de São Luís)
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
QUERY = f"""
[out:json][timeout:180][bbox:{BBOX}];
(
  nwr[amenity~"^(school|kindergarten|university|college|hospital|clinic|doctors|dentist|pharmacy|library|cafe|marketplace|bank|police|fire_station|bus_station|theatre|cinema|arts_centre)$"][name];
  nwr[shop~"^(mall|supermarket|wholesale|bakery|chemist)$"][name];
  nwr[leisure~"^(fitness_centre|sports_centre|park)$"][name];
  nwr[tourism~"^(museum|attraction)$"][name];
  nwr[healthcare][name];
  nwr[natural=beach][name];
);
out center meta;
node[place~"^(suburb|neighbourhood|quarter)$"][name];
out;
"""
KEEP = {"amenity", "shop", "leisure", "tourism", "healthcare", "natural", "name", "operator", "operator:type",
        "phone", "contact:phone", "website", "contact:website", "opening_hours", "isced:level", "wheelchair",
        "brand", "addr:street", "addr:housenumber", "addr:suburb", "addr:city", "healthcare:speciality",
        "emergency", "check_date", "disused", "school:language"}


def fetch():
    body = urllib.parse.urlencode({"data": QUERY}).encode()
    for url in MIRRORS:
        for attempt in range(2):
            try:
                req = urllib.request.Request(url, data=body, headers={"User-Agent": "vizinhanca-slz (GitHub Actions)"})
                return json.load(urllib.request.urlopen(req, timeout=240))
            except Exception as e:  # noqa: BLE001
                print("falhou", url, e, file=sys.stderr)
                time.sleep(15)
    sys.exit("Nenhum servidor Overpass respondeu")


def main():
    data = fetch()
    places, items = [], []
    for el in data["elements"]:
        tags = el.get("tags", {})
        if el["type"] == "node" and "place" in tags:
            places.append([tags["name"], round(el["lat"], 5), round(el["lon"], 5)])
            continue
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None:
            continue
        t = {k: v for k, v in tags.items() if k in KEEP}
        if el.get("timestamp"):
            t["_ts"] = el["timestamp"][:10]
        items.append([el["type"][0] + str(el["id"]), round(lat, 5), round(lon, 5), t])

    # bairro mais próximo (aproximação pelo ponto do bairro no OSM)
    def near(lat, lon):
        best, bd = "", 1e9
        for n, a, b in places:
            d = (a - lat) ** 2 + ((b - lon) * math.cos(math.radians(lat))) ** 2
            if d < bd:
                best, bd = n, d
        return best
    for it in items:
        if "_b" not in it[3]:
            it[3]["_b"] = it[3].get("addr:suburb") or near(it[1], it[2])

    if len(items) < 800:
        sys.exit(f"Poucos resultados ({len(items)}); mantendo o arquivo anterior")
    os.makedirs("data", exist_ok=True)
    out = {"updated": datetime.date.today().isoformat(), "source": "OpenStreetMap via Overpass API", "items": items}
    json.dump(out, open("data/pois.json", "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(places, open("data/bairros.json", "w"), ensure_ascii=False, separators=(",", ":"))
    print(len(items), "lugares,", len(places), "bairros")


if __name__ == "__main__":
    main()
