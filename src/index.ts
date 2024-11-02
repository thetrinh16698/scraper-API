import express, { Application, Request, Response } from "express";
import puppeteer from "puppeteer";

const app: Application = express();
const PORT = 3000;

app.use(express.json());

app.post("/scrape", async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;

    if (!url) {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0" });

    const fonts = await page.evaluate(() => {
      const stylesheets = Array.from(document.styleSheets);
      let allFonts: any[] = [];

      // Create a temporary div to compute styles with potential CSS variables resolved
      const tempDiv = document.createElement("div");
      document.body.appendChild(tempDiv);

      stylesheets.forEach((stylesheet: CSSStyleSheet) => {
        try {
          const rules = Array.from(stylesheet.cssRules);
          rules.forEach((rule) => {
            if (rule instanceof CSSFontFaceRule) {
              const fontFamily = rule.style
                .getPropertyValue("font-family")
                .replace(/"/g, "");
              const fontVariant = rule.style.getPropertyValue("font-variant");
              const fontWeight =
                rule.style.getPropertyValue("font-weight") || "400";
              const fontUrlMatch = rule.style
                .getPropertyValue("src")
                .match(/url\((.*?)\)/);
              const fontUrl = fontUrlMatch
                ? fontUrlMatch[1].replace(/"/g, "")
                : null;

              // Apply font face as a style to tempDiv to resolve any CSS variables
              tempDiv.style.fontFamily = fontFamily;
              document.body.appendChild(tempDiv);
              const computedStyle = window.getComputedStyle(tempDiv);

              // Try to resolve letter-spacing variable using computed style
              const letterSpacing =
                computedStyle.getPropertyValue("letter-spacing") || "normal";

              const fontData = {
                family: fontFamily,
                variants: fontVariant,
                letterSpacings: letterSpacing,
                fontWeight,
                url: fontUrl,
              };
              allFonts.push(fontData);
            }
          });
        } catch (e) {
          console.error("Failed to read rules from stylesheet", e);
        }
      });

      // Clean up temporary element
      document.body.removeChild(tempDiv);

      return allFonts;
    });

    const primaryButton = await page.evaluate(() => {
      const button = document.querySelector('form[action*="/cart/add"] button');
      if (!button) return null;

      const style = window.getComputedStyle(button);

      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        textTransform: style.textTransform,
        textDecoration: style.textDecoration,
        textAlign: style.textAlign,
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth,
        borderRadius: style.borderRadius,
      };
    });

    await browser.close();

    res.json({ fonts, primaryButton });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while scraping" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
