# Public name vocabulary

English and French lists from [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words), commit `5faf2ba42d7b1c0977169ec3611df25a3c08eb13`. © 2012–2020 Shutterstock, Inc., CC BY 4.0 (see LICENSE). Lists are unmodified; the application normalizes them at runtime. Review upstream updates periodically.

`whole-word.txt` and `allow.txt` are project-owned. `whole-word.txt` lists words from `en.txt`/`fr.txt` that are refused only as a whole word, because they also spell part of ordinary words (`semen` in basement). `allow.txt` lists ordinary words and place names that are never read as a listed word (Scunthorpe, Milford, Peter). To fix a false positive, add an entry to one of these files instead of editing the upstream lists, then run `backend/tests/moderation.php`.
