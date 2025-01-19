export function createESPlayDocument(code: string) {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ESPlay Demo</title>
    <script src="https://unpkg.com/esplay@0.0.6" crossorigin></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="text/babel">${code}</script>
  </body>
</html>
`.trim();
}
