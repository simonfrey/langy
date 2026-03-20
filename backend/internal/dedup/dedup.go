package dedup

import (
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

var multiSpace = regexp.MustCompile(`\s+`)

// CardText represents a card's front and back text for comparison.
type CardText struct {
	Front string
	Back  string
}

// NormalizeText lowercases, trims, normalizes unicode, and collapses whitespace.
func NormalizeText(s string) string {
	s = norm.NFC.String(s)
	s = strings.Map(func(r rune) rune {
		return unicode.ToLower(r)
	}, s)
	s = strings.TrimSpace(s)
	s = multiSpace.ReplaceAllString(s, " ")
	return s
}

// levenshtein computes the Levenshtein distance between two strings.
func levenshtein(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	la, lb := len(ra), len(rb)
	if la == 0 {
		return lb
	}
	if lb == 0 {
		return la
	}

	prev := make([]int, lb+1)
	curr := make([]int, lb+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= la; i++ {
		curr[0] = i
		for j := 1; j <= lb; j++ {
			cost := 1
			if ra[i-1] == rb[j-1] {
				cost = 0
			}
			curr[j] = min(curr[j-1]+1, min(prev[j]+1, prev[j-1]+cost))
		}
		prev, curr = curr, prev
	}
	return prev[lb]
}

// isSimilar checks if two normalized strings are duplicates using Levenshtein distance.
// Returns true if the strings are identical or within the similarity threshold.
func isSimilar(a, b string, threshold float64) bool {
	if a == b {
		return true
	}
	maxLen := max(len([]rune(a)), len([]rune(b)))
	if maxLen == 0 {
		return true
	}
	dist := levenshtein(a, b)
	return float64(dist)/float64(maxLen) < threshold
}

// FilterDuplicates removes generated cards that already exist in the deck
// and removes duplicates within the generated batch itself.
// A card is considered duplicate if both front AND back are similar to an existing card.
func FilterDuplicates(generated []CardText, existing []CardText, threshold float64) []CardText {
	// Normalize existing cards
	normExisting := make([]CardText, len(existing))
	for i, c := range existing {
		normExisting[i] = CardText{
			Front: NormalizeText(c.Front),
			Back:  NormalizeText(c.Back),
		}
	}

	var result []CardText
	seen := make([]CardText, 0, len(generated))

	for _, g := range generated {
		normG := CardText{
			Front: NormalizeText(g.Front),
			Back:  NormalizeText(g.Back),
		}

		// Check against existing cards in deck
		dup := false
		for _, e := range normExisting {
			if isSimilar(normG.Front, e.Front, threshold) && isSimilar(normG.Back, e.Back, threshold) {
				dup = true
				break
			}
		}
		if dup {
			continue
		}

		// Check against already-accepted generated cards (within-batch dedup)
		for _, s := range seen {
			if isSimilar(normG.Front, s.Front, threshold) && isSimilar(normG.Back, s.Back, threshold) {
				dup = true
				break
			}
		}
		if dup {
			continue
		}

		seen = append(seen, normG)
		result = append(result, g)
	}

	return result
}
