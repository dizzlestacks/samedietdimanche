import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supportedLanguages } from "@/i18n";

export function LanguageSelector({ mobile = false }: { mobile?: boolean }) {
  const { i18n } = useTranslation();

  const currentLang = supportedLanguages.find((l) => l.code === i18n.language) || supportedLanguages[0];

  if (mobile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="text-base font-medium p-2 hover:bg-muted rounded-md flex items-center gap-2 w-full text-left"
            data-testid="button-language-mobile"
          >
            <Globe className="w-4 h-4 text-primary" />
            {currentLang.flag} {currentLang.name}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {supportedLanguages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
              className={i18n.language === lang.code ? "bg-primary/10 font-semibold" : ""}
              data-testid={`button-lang-${lang.code}`}
            >
              <span className="mr-2">{lang.flag}</span>
              {lang.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          data-testid="button-language-selector"
        >
          <Globe className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={i18n.language === lang.code ? "bg-primary/10 font-semibold" : ""}
            data-testid={`button-lang-${lang.code}`}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
