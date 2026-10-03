<?php
declare(strict_types=1);
namespace App;
// Deterministic public-name filter over the attributed word lists in content/moderation.
// It is not a guarantee against every abusive name. A name is refused when any word, or any
// run of adjacent words joined together (so "f u c k" or "fu ck" are read as one word),
// equals a listed word. Listed words of four letters or more are also refused inside a
// longer name, unless whole-word.txt marks them ambiguous (péter hides in Peterborough).
// allow.txt holds ordinary words that must never be read as a listed one (Scunthorpe).
// Stretched letters, accents, leetspeak and Cyrillic/Greek look-alikes all read as the plain word.
final class NameModeration
{
    private const LEET = [
        '0' => 'o',
        '1' => 'i',
        '3' => 'e',
        '4' => 'a',
        '5' => 's',
        '7' => 't',
        '8' => 'b',
        '9' => 'g',
        '@' => 'a',
        '$' => 's',
        '!' => 'i',
        '|' => 'i',
        '€' => 'e',
        '+' => 't',
    ];
    // Cyrillic and Greek letters drawn like Latin ones. Names are checked twice: transliterated
    // (фак reads fak) and as the Latin word these letters imitate (сосk reads cock).
    private const LOOKALIKE = [
        'а' => 'a',
        'в' => 'b',
        'е' => 'e',
        'ё' => 'e',
        'к' => 'k',
        'м' => 'm',
        'н' => 'h',
        'о' => 'o',
        'п' => 'n',
        'р' => 'p',
        'с' => 'c',
        'т' => 't',
        'у' => 'y',
        'х' => 'x',
        'ь' => 'b',
        'ѕ' => 's',
        'і' => 'i',
        'ї' => 'i',
        'ј' => 'j',
        'ԁ' => 'd',
        'һ' => 'h',
        'ԛ' => 'q',
        'ԝ' => 'w',
        'α' => 'a',
        'β' => 'b',
        'ε' => 'e',
        'η' => 'n',
        'ι' => 'i',
        'κ' => 'k',
        'ν' => 'v',
        'ο' => 'o',
        'ρ' => 'p',
        'τ' => 't',
        'υ' => 'u',
        'χ' => 'x',
        'ω' => 'w',
    ];
    private ?\Transliterator $latin = null;
    private array|false|null $rules = null;
    public function __construct(private string $directory = __DIR__ . '/../content/moderation') {}

    public function allows(string $name): bool
    {
        $rules = $this->rules ??= $this->load();
        // Fail closed: without its lists the filter would accept every name.
        if ($rules === false) {
            return false;
        }
        foreach ([false, true] as $lookalike) {
            $words = [];
            foreach (
                preg_split('/[^\p{L}\p{M}\p{N}@$!|€+]+/u', $name, -1, PREG_SPLIT_NO_EMPTY)
                as $part
            ) {
                if (($word = $this->fold($part, $lookalike)) !== '') {
                    $words[] = $word;
                }
            }
            // Every run of adjacent words, e.g. f/u/c/k, fu/ck and f/u/ck. Runs inside an allowed
            // phrase are skipped, so cul-de-sac never reads as cul.
            $runs = [];
            $allowed = [];
            foreach ($words as $i => $_) {
                for ($j = $i, $run = ''; $j < count($words); $j++) {
                    $run .= $words[$j];
                    $runs[] = [$i, $j, $run];
                    if (
                        isset($rules['allow'][$run]) ||
                        (str_ends_with($run, 's') && isset($rules['allow'][substr($run, 0, -1)]))
                    ) {
                        $allowed[] = [$i, $j];
                    }
                }
            }
            foreach ($runs as [$i, $j, $run]) {
                foreach ($allowed as [$from, $to]) {
                    if ($from <= $i && $j <= $to) {
                        continue 2;
                    }
                }
                if (preg_match($rules['whole'], $run)) {
                    return false;
                }
            }
            // Inside a word, fragments of one or two letters join their neighbours (fu ckville), but
            // whole words stay apart so Pine Grove never reads as negro.
            $chunks = [];
            foreach ($words as $i => $word) {
                if ($i && (strlen($word) < 3 || strlen($words[$i - 1]) < 3)) {
                    $chunks[count($chunks) - 1] .= $word;
                } else {
                    $chunks[] = $word;
                }
            }
            foreach ($chunks as $chunk) {
                if (
                    $rules['inside'] !== null &&
                    preg_match($rules['inside'], strtr($chunk, $rules['allow']))
                ) {
                    return false;
                }
            }
        }
        return true;
    }

    // Lower-case ASCII letters only, so every spelling of a word compares equal.
    public function fold(string $text, bool $lookalike = false): string
    {
        $this->latin ??=
            \Transliterator::create(
                'Any-Latin; NFD; [:Nonspacing Mark:] Remove; Latin-ASCII; Lower',
            ) ?? throw new \RuntimeException('ICU transliteration is unavailable.');
        $text = mb_strtolower(\Normalizer::normalize($text, \Normalizer::FORM_KC) ?: $text);
        if ($lookalike) {
            $text = strtr($text, self::LOOKALIKE);
        }
        return preg_replace(
            '/[^a-z]/',
            '',
            (string) $this->latin->transliterate(strtr($text, self::LEET)),
        );
    }

    private function load(): array|false
    {
        $read = function (string $file): ?array {
            $lines = is_readable($this->directory . '/' . $file)
                ? file(
                    $this->directory . '/' . $file,
                    FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES,
                )
                : false;
            if ($lines === false) {
                return null;
            }
            $words = [];
            foreach ($lines as $line) {
                if (!str_starts_with($line, '#') && ($word = $this->fold($line)) !== '') {
                    $words[$word] = true;
                }
            }
            return $words;
        };
        [$en, $fr, $whole, $allow] = [
            $read('en.txt'),
            $read('fr.txt'),
            $read('whole-word.txt'),
            $read('allow.txt'),
        ];
        if (!$en || !$fr || $whole === null || $allow === null) {
            error_log(
                'Name moderation lists are missing from ' .
                    $this->directory .
                    '; refusing public names.',
            );
            return false;
        }
        $blocked = $en + $fr;
        $inside = array_diff_key(
            array_filter($blocked, fn($w) => strlen((string) $w) >= 4, ARRAY_FILTER_USE_KEY),
            $whole,
        );
        // A letter matches once or stretched to three or more (fuuuck), but not doubled, since
        // ordinary words double letters (annal, rapping, puppeteer). Longer words may take a plural s.
        $pattern = fn(array $words) => implode(
            '|',
            array_map(
                fn($w) => implode(
                    '',
                    array_map(fn($c) => $c . '(?:' . $c . $c . '+)?', str_split((string) $w)),
                ),
                array_keys($words),
            ),
        );
        $short = array_filter($blocked, fn($w) => strlen((string) $w) < 4, ARRAY_FILTER_USE_KEY);
        $long = array_diff_key($blocked, $short);
        // strtr() replaces the longest allowed word first; | keeps the pieces on either side apart.
        return [
            'whole' => '/^(?:(?:' . $pattern($short) . ')|(?:' . $pattern($long) . ')s?)$/',
            'inside' => $inside ? '/' . $pattern($inside) . '/' : null,
            'allow' => array_map(fn() => '|', $allow),
        ];
    }
}
