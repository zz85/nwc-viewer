/* this deals with drawing ties */

function layoutTies() {
	const staves = data.score.staves
	staves.forEach((stave) => {
        var ties = stave.tokens
            .filter(token => token.type === 'Note')
            .filter(token => token.tie || token.tieEnd)
        
        var i = 0;
        while (i < ties.length) {
            var note = ties[i];
            
            if (note.tie) {
                var start = note.drawingNoteHead

                // find connecting note
                var j = i+1;        
                while (j < ties.length) {
                    var connecting = ties[j];
                    if (connecting.tieEnd) {
                        var end = connecting.drawingNoteHead
                        var tie = new Tie(start, end)
                        drawing.add(tie)
                        break;
                    }
                    j++
                }
            }

            // if (token.tie) {
            // 	var text = new Text("((((", 0, {
            // 		font: '12px arial',
            // 		textAlign: 'center',
            // 	})
            // 	text.moveTo(notehead.x, notehead.y + 10)
            // 	drawing.add(text)
            // }


            i++
        }
        
	})
}

export { layoutTies }
