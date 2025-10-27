package agnost

import (
	"crypto/rand"
	"fmt"
)

func generateSessionID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		panic(err) // or handle properly
	}

	// Set version (4) at 7th byte
	b[6] = (b[6] & 0x0f) | 0x40
	// Set variant (10xxxxxx) at 9th byte
	b[8] = (b[8] & 0x3f) | 0x80

	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
