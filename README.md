# Vizinhança SLZ

Mapa interativo da Ilha de São Luís (MA) para escolher onde morar.

**Acesse:** https://LauroAnd34.github.io/vizinhanca-slz/

- Escolas separadas por rede (municipal, estadual, federal, particular, bilíngue, comunitária), universidades públicas e particulares, ensino técnico
- Hospitais (público, particular, filantrópico), UPAs 24h, postos de saúde, clínicas médicas e odontológicas, laboratórios, farmácias
- Shoppings, supermercados e atacarejos, padarias, cafeterias, feiras, academias, parques, praias, bibliotecas, museus, bancos, polícia, terminais e pontos de ônibus
- Destaques: escolas com as maiores médias no ENEM 2019 (último ano com média por escola divulgada pelo INEP) e principais universidades
- **Ao redor do imóvel:** toque no mapa, busque o endereço ou use sua localização. O site consulta o OpenStreetMap **ao vivo** naquele raio, mostra o mais próximo de cada tipo com distância e tempo a pé, e avisa quando um lugar não é revisado há muito tempo (abre o Street View para conferir)
- Link compartilhável de cada ponto (`#p=lat,lon,raio`) e comparação entre imóveis salvos

## Dados

- `data/pois.json` e `data/bairros.json` são atualizados toda segunda-feira pelo GitHub Actions (`.github/workflows/update-data.yml`) usando a Overpass API. Para atualizar na hora: aba **Actions → Atualizar dados do OpenStreetMap → Run workflow**.
- A classificação das escolas usa as tags `operator` / `operator:type` do OpenStreetMap; quando faltam, a rede é deduzida pelo nome (marcada com *).
- Achou algo errado ou fechado? Cada lugar tem o botão **Corrigir no OSM**; a correção aparece aqui na próxima atualização.

Dados © colaboradores do [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
