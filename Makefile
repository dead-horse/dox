
TESTS = test/*.test.js
REPORTER = tap 

test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--ui exports \
		--reporter $(REPORTER) \
		$(TESTS)

docs:
	@./bin/dox \
	  --verbose \
	  lib/* \
	  --out docs \
	  --title Dox \
	  --github visionmedia/dox \
	  --index index.md

doc-server:
	@./bin/dox \
		--server docs

.PHONY: test docs
