# Perigon Taxonomy

## Categories

Perigon's top-level content categories. Use with the `category` parameter on articles and stories endpoints.

| Category | Description |
|---|---|
| `Auto` | Automotive industry, cars, EVs |
| `Business` | Business news, companies, corporate |
| `Entertainment` | Entertainment, celebrities, TV, streaming |
| `Environment` | Environment, sustainability, conservation |
| `Finance` | Financial markets, banking, investing |
| `Health` | Health, medicine, pharmaceuticals |
| `Lifestyle` | Lifestyle, culture, food, fashion |
| `Politics` | Political news, policy, government |
| `Science` | Science, research, discoveries |
| `Sports` | Sports coverage across all sports |
| `Tech` | Technology, software, hardware, startups |
| `Travel` | Travel, tourism, destinations |
| `Weather` | Weather events, forecasts, climate data |
| `World` | International news, global affairs |

## Topic Tags

More specific topic tags within categories. Use with the `topic` parameter.

| Topic | Typical Category |
|---|---|
| `AI` | Tech |
| `Cryptocurrency` | Tech / Finance |
| `Gaming` | Entertainment |
| `NFL` | Sports |
| `NBA` | Sports |
| `MLB` | Sports |
| `UFC` | Sports |
| `Tennis` | Sports |
| `Golf` | Sports |
| `Soccer` | Sports |
| `Formula 1` | Sports |
| `Space` | Science |
| `Climate Change` | Science / Environment |
| `Economy` | Finance |
| `Real Estate` | Finance |
| `Fitness` | Health / Lifestyle |
| `Parenting` | Lifestyle |
| `Movies` | Entertainment |
| `Music` | Entertainment |

## Labels

Content labels that can be used with `excludeLabel` to filter out unwanted content:

| Label | Description |
|---|---|
| `Non-news` | Non-news content (listicles, how-tos, etc.) |
| `Opinion` | Opinion/editorial pieces |
| `Paid News` | Sponsored/paid content |
| `Press Release` | Press releases |

## Source Groups

| Group | Description |
|---|---|
| `top100` | Perigon's curated list of ~100 top news sources. Static list, same across all topics. Excludes niche/specialty sources. |

## Browsing Topics

The `/v1/topics` endpoint can be used to explore the full taxonomy of available topics programmatically.
