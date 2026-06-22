package api

import (
	"reflect"
	"testing"
)

func TestSplitList(t *testing.T) {
	cases := map[string][]string{
		"":                         nil,
		"a,b,c":                    {"a", "b", "c"},
		"a\nb\nc":                  {"a", "b", "c"},
		" A , a ,B ":               {"a", "b"}, // lowercased + de-duped + trimmed
		"go\tlogin pricing":        {"go", "login", "pricing"},
		"x,,,y":                    {"x", "y"}, // empty fields dropped
		"Admin\nadmin\nPOSTMASTER": {"admin", "postmaster"},
	}
	for in, want := range cases {
		got := splitList(in)
		if !reflect.DeepEqual(got, want) {
			t.Errorf("splitList(%q) = %v, want %v", in, got, want)
		}
	}
}
